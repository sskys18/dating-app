import Foundation

enum MessageStatus: String, Codable {
    case sent
    case delivered
    case read
}

struct ChatMessage: Codable, Identifiable {
    let id: String
    let chatRoomId: String
    let senderId: String
    let content: String
    let status: MessageStatus
    let createdAt: Date
    let tempId: String?
}

struct ChatRoomDetail: Codable, Identifiable {
    let id: String
    let matchId: String
    let starters: [String]
    let createdAt: Date
}

struct MatchListItem: Codable, Identifiable {
    let id: String
    let otherUser: MatchUser
    let chatRoomId: String
    let lastMessage: LastMessagePreview?
    let unreadCount: Int
    let createdAt: Date
}

struct LastMessagePreview: Codable {
    let content: String
    let senderId: String
    let createdAt: Date
}

struct LikeResponse: Codable {
    let matched: Bool
    let matchId: String?
    let chatRoomId: String?
}

struct LikeQuota: Codable {
    let used: Int
    let quota: Int?
}

struct PaginatedResponse<T: Codable>: Codable {
    let items: [T]
    let nextCursor: String?
    let hasMore: Bool
}
