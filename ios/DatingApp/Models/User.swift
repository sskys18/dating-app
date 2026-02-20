import Foundation

struct UserProfile: Codable, Identifiable {
    let id: String
    var nickname: String?
    var age: Int?
    var gender: String?
    var bio: String?
    var introLine: String?
    var locationLabel: String?
    var typeId: Int?
    var typeVisible: Bool
    var axisCVisible: Bool
    var profileComplete: Bool
    var photos: [UserPhoto]
}

struct UserPhoto: Codable, Identifiable {
    let id: String
    let url: String
    let position: Int
    let isPrimary: Bool
}

struct FeedCard: Codable, Identifiable {
    let userId: String
    let nickname: String
    let age: Int
    let introLine: String?
    let photoUrl: String
    let locationLabel: String?
    let compatibilityScore: Int
    let typeLabel: String?

    var id: String { userId }
}

struct MatchInfo: Codable, Identifiable {
    let id: String
    let otherUser: MatchUser
    let chatRoomId: String
    let createdAt: Date
}

struct MatchUser: Codable {
    let id: String
    let nickname: String
    let photoUrl: String
}

enum SubscriptionPlan: String, Codable {
    case free
    case plus
    case premium
}

struct Entitlement: Codable {
    let plan: SubscriptionPlan
    let fullFeed: Bool
    let unlimitedLikes: Bool
    let rewind: Bool
    let advancedPrefs: Bool
    let likesYou: Bool
    let incognito: Bool
    let travel: Bool
    let priorityLikes: Bool
    let dailyLikeQuota: Int?
}

extension Entitlement {
    static let free = Entitlement(
        plan: .free, fullFeed: false, unlimitedLikes: false, rewind: false,
        advancedPrefs: false, likesYou: false, incognito: false, travel: false,
        priorityLikes: false, dailyLikeQuota: 5
    )
}

struct UpdateProfileRequest: Encodable {
    var nickname: String?
    var birthDate: String?
    var gender: String?
    var bio: String?
    var introLine: String?
    var locationLat: Double?
    var locationLng: Double?
    var locationLabel: String?
    var typeVisible: Bool?
    var axisCVisible: Bool?
}
