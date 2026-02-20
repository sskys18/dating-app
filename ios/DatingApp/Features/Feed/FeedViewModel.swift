import SwiftUI

@MainActor
class FeedViewModel: ObservableObject {
    @Published var dragOffset: CGSize = .zero
    @Published var showMatchAnimation = false
    @Published var matchedUser: MatchUser?
    @Published var matchedChatRoomId: String?

    var dragRotation: Double {
        Double(dragOffset.width / 20)
    }

    var likeOpacity: Double {
        max(0, Double(dragOffset.width) / 100)
    }

    var passOpacity: Double {
        max(0, Double(-dragOffset.width) / 100)
    }

    func handleSwipe(card: FeedCard, feedService: FeedService) async {
        let action = dragOffset.width > 0 ? "like" : "pass"
        let response = await feedService.likeOrPass(targetUserId: card.userId, action: action)
        feedService.removeTopCard()
        dragOffset = .zero

        if let response = response, response.matched {
            matchedUser = MatchUser(id: card.userId, nickname: card.nickname, photoUrl: card.photoUrl)
            matchedChatRoomId = response.chatRoomId
            showMatchAnimation = true
        }
    }

    func dismissMatch() {
        showMatchAnimation = false
        matchedUser = nil
        matchedChatRoomId = nil
    }
}
