import Foundation

actor PhotoUploadService {
    static let shared = PhotoUploadService()

    struct PresignResponse: Decodable {
        let uploadUrl: String
        let key: String
        let photoId: String
    }

    struct PhotoConfirmResponse: Decodable {
        let photo: UserPhoto
    }

    private struct ReorderBody: Encodable {
        let photoIds: [String]
    }

    func upload(imageData: Data, filename: String, contentType: String) async throws -> UserPhoto {
        // 1. Get presigned URL
        let presignBody = ["filename": filename, "contentType": contentType]
        let presign: PresignResponse = try await APIClient.shared.post(
            path: "/photos/presign",
            body: presignBody
        )

        // 2. Upload to S3 via presigned URL (direct URLSession, not APIClient)
        guard let uploadURL = URL(string: presign.uploadUrl) else {
            throw APIError.invalidURL
        }

        var uploadRequest = URLRequest(url: uploadURL)
        uploadRequest.httpMethod = "PUT"
        uploadRequest.setValue(contentType, forHTTPHeaderField: "Content-Type")
        uploadRequest.httpBody = imageData

        let (_, uploadResponse) = try await URLSession.shared.data(for: uploadRequest)

        guard let httpResponse = uploadResponse as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            let statusCode = (uploadResponse as? HTTPURLResponse)?.statusCode ?? 0
            throw APIError.httpError(statusCode: statusCode, message: "S3 upload failed")
        }

        // 3. Confirm upload
        let confirmed: PhotoConfirmResponse = try await APIClient.shared.post(
            path: "/photos/\(presign.photoId)/confirm"
        )

        return confirmed.photo
    }

    func delete(photoId: String) async throws {
        let _: EmptyDeleteResponse = try await APIClient.shared.request(
            method: "DELETE",
            path: "/photos/\(photoId)"
        )
    }

    func reorder(photoIds: [String]) async throws {
        let body = ReorderBody(photoIds: photoIds)
        let _: EmptyDeleteResponse = try await APIClient.shared.request(
            method: "PATCH",
            path: "/photos/reorder",
            body: body
        )
    }

    private struct EmptyDeleteResponse: Decodable {}
}
