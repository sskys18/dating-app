import SwiftUI

@MainActor
class MatchService: ObservableObject {
    @Published var matches: [MatchListItem] = []
    @Published var isLoading = false

    func fetchMatches() async {
        isLoading = true
        defer { isLoading = false }
        do {
            matches = try await APIClient.shared.get(path: "/messaging/matches")
        } catch {
            // Keep existing matches on failure
        }
    }

    func updateLastMessage(chatRoomId: String, content: String, senderId: String) {
        guard let index = matches.firstIndex(where: { $0.chatRoomId == chatRoomId }) else { return }
        var updated = matches
        let item = updated[index]
        let preview = LastMessagePreview(content: content, senderId: senderId, createdAt: Date())
        updated[index] = MatchListItem(
            id: item.id, otherUser: item.otherUser, chatRoomId: item.chatRoomId,
            lastMessage: preview, unreadCount: item.unreadCount, createdAt: item.createdAt
        )
        let moved = updated.remove(at: index)
        updated.insert(moved, at: 0)
        matches = updated
    }
}
