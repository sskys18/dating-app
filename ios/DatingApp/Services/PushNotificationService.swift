import SwiftUI
import UIKit
import UserNotifications

@MainActor
class PushNotificationService: NSObject, ObservableObject, UNUserNotificationCenterDelegate {
    /// Shared instance. AppDelegate (created by UIKit before SwiftUI) and the
    /// SwiftUI App struct must reference the same object so the APNs token
    /// callback and the notification-center delegate land on one place.
    static let shared = PushNotificationService()

    @Published var isAuthorized = false

    // Weak refs into app state so push taps can drive navigation and the badge
    // fallback can read the match list. Set from DatingAppApp once the
    // environment objects exist. Weak to avoid a retain cycle with the singleton.
    weak var appState: AppState?
    weak var matchService: MatchService?

    func requestPermission() {
        UNUserNotificationCenter.current().delegate = self
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
            Task { @MainActor in
                self.isAuthorized = granted
                if granted {
                    UIApplication.shared.registerForRemoteNotifications()
                } else {
                    // REQ-PUSH-02: permission denied — fall back to in-app badges
                    // driven by the match list instead of push payloads.
                    self.refreshBadgesFromMatches()
                }
            }
        }
    }

    func registerDeviceToken(_ tokenData: Data) async {
        let token = tokenData.map { String(format: "%02x", $0) }.joined()
        struct RegisterRequest: Encodable {
            let token: String
            let platform: String
        }
        struct EmptyResponse: Decodable {}
        let _ = try? await APIClient.shared.post(
            path: "/notifications/register",
            body: RegisterRequest(token: token, platform: "ios")
        ) as EmptyResponse
    }

    // MARK: - REQ-PUSH-02: in-app badge fallback

    /// Recomputes AppState's unread counters from the current match list so the
    /// Matches tab badge stays accurate even when push is denied (or whenever the
    /// app refreshes matches). Idempotent — safe to call repeatedly.
    func refreshBadgesFromMatches() {
        guard let appState, let matchService else { return }
        let matches = matchService.matches
        appState.totalUnreadMessages = matches.reduce(0) { $0 + $1.unreadCount }
        appState.unreadMatchCount = matches.filter { $0.unreadCount > 0 }.count
    }

    /// Fetches matches then refreshes the badges. Used as the no-push path to keep
    /// the tab badge current.
    func refreshUnreadFallback() async {
        guard let matchService else { return }
        await matchService.fetchMatches()
        refreshBadgesFromMatches()
    }

    // MARK: - UNUserNotificationCenterDelegate

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        return [.banner, .badge, .sound]
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        let userInfo = response.notification.request.content.userInfo
        if let type = userInfo["type"] as? String {
            await MainActor.run {
                handleNotificationRoute(type: type, userInfo: userInfo)
            }
        }
    }

    func handleNotificationRoute(type: String, userInfo: [AnyHashable: Any]) {
        // chatRoomId arrives for new_message (and is present on new_match payloads
        // too); fall back to matchId-less routing if absent.
        let chatRoomId = userInfo["chatRoomId"] as? String
        appState?.routeFromNotification(type: type, chatRoomId: chatRoomId)
    }
}
