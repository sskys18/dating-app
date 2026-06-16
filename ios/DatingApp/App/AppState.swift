import SwiftUI
import Combine

enum AppRoute: Equatable {
    case splash
    case auth
    case handoffClaim(token: String)
    case profileSetup
    case main
}

enum MainTab: Int {
    case discover
    case matches
    case profile
}

@MainActor
class AppState: ObservableObject {
    @Published var currentRoute: AppRoute = .splash
    @Published var isAuthenticated = false
    @Published var isProfileComplete = false
    @Published var pendingHandoffToken: String?
    @Published var userProfile: UserProfile?
    @Published var unreadMatchCount: Int = 0
    @Published var totalUnreadMessages: Int = 0

    // Selected tab on MainTabView. Single source of truth for tab selection so a
    // notification tap can route to the Matches tab. MainTabView binds its
    // TabView selection to this value.
    @Published var selectedTab: MainTab = .discover

    // Chat room a notification tap requested. MatchListView observes this and
    // pushes the corresponding ChatView, then clears it back to nil.
    @Published var pendingChatRoomId: String?

    /// Routes an incoming push tap. Called from PushNotificationService once the
    /// user is on (or sent to) the main app surface.
    func routeFromNotification(type: String, chatRoomId: String?) {
        guard currentRoute == .main else { return }
        switch type {
        case "new_match":
            selectedTab = .matches
        case "new_message":
            selectedTab = .matches
            pendingChatRoomId = chatRoomId
        default:
            break
        }
    }

    func resolveRoute() {
        if isAuthenticated, let token = pendingHandoffToken {
            pendingHandoffToken = nil
            currentRoute = .handoffClaim(token: token)
        } else if !isAuthenticated {
            currentRoute = .auth
        } else if !isProfileComplete {
            currentRoute = .profileSetup
        } else {
            currentRoute = .main
        }
    }
}
