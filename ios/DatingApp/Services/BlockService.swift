import SwiftUI

@MainActor
class BlockService: ObservableObject {
    func blockUser(blockedId: String) async -> Bool {
        struct BlockRequest: Encodable { let blockedId: String }
        do {
            let _: EmptyBlockResponse = try await APIClient.shared.post(
                path: "/blocks", body: BlockRequest(blockedId: blockedId)
            )
            return true
        } catch {
            return false
        }
    }

    func unblockUser(blockedId: String) async -> Bool {
        do {
            let _: EmptyBlockResponse = try await APIClient.shared.request(
                method: "DELETE", path: "/blocks/\(blockedId)"
            )
            return true
        } catch {
            return false
        }
    }

    private struct EmptyBlockResponse: Decodable {}
}
