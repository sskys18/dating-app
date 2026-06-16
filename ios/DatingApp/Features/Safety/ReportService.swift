import Foundation

/// POSTs user reports to /reports. Mirrors BlockService's request shape
/// (relative path; APIClient prepends the /api base + attaches the bearer token).
final class ReportService {
    static let shared = ReportService()

    private init() {}

    func submitReport(
        reportedId: String,
        reason: String,
        description: String?,
        chatRoomId: String?
    ) async -> Bool {
        struct ReportRequest: Encodable {
            let reportedId: String
            let reason: String
            let description: String?
            let chatRoomId: String?
        }
        do {
            let _: EmptyReportResponse = try await APIClient.shared.post(
                path: "/reports",
                body: ReportRequest(
                    reportedId: reportedId,
                    reason: reason,
                    description: description,
                    chatRoomId: chatRoomId
                )
            )
            return true
        } catch {
            return false
        }
    }

    private struct EmptyReportResponse: Decodable {}
}
