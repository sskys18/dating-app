import SwiftUI

@MainActor
class FeedService: ObservableObject {
    @Published var cards: [FeedCard] = []
    @Published var isLoading = false
    @Published var likeQuota: LikeQuota?

    private var nextCursor: String?
    private var hasMore = true

    func fetchFeed() async {
        guard !isLoading, hasMore else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            var path = "/feed?limit=20"
            if let cursor = nextCursor { path += "&cursor=\(cursor)" }
            let response: PaginatedResponse<FeedCard> = try await APIClient.shared.get(path: path)
            cards.append(contentsOf: response.items)
            nextCursor = response.nextCursor
            hasMore = response.hasMore
        } catch {
            // Keep existing cards on failure
        }
    }

    func likeOrPass(targetUserId: String, action: String) async -> LikeResponse? {
        struct LikeRequest: Encodable {
            let targetUserId: String
            let action: String
        }
        do {
            let response: LikeResponse = try await APIClient.shared.post(
                path: "/feed/like",
                body: LikeRequest(targetUserId: targetUserId, action: action)
            )
            if action == "like" { await fetchQuota() }
            return response
        } catch {
            return nil
        }
    }

    func fetchQuota() async {
        do {
            likeQuota = try await APIClient.shared.get(path: "/feed/quota")
        } catch {
            // Keep existing quota on failure
        }
    }

    func removeTopCard() {
        guard !cards.isEmpty else { return }
        cards.removeFirst()
        if cards.count < 5 { Task { await fetchFeed() } }
    }

    func reset() {
        cards = []
        nextCursor = nil
        hasMore = true
    }
}
