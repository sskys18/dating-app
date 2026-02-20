import SwiftUI
import UIKit
import UserNotifications

@MainActor
class PushNotificationService: NSObject, ObservableObject, UNUserNotificationCenterDelegate {
    @Published var isAuthorized = false

    func requestPermission() {
        UNUserNotificationCenter.current().delegate = self
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
            Task { @MainActor in
                self.isAuthorized = granted
                if granted {
                    DispatchQueue.main.async {
                        UIApplication.shared.registerForRemoteNotifications()
                    }
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
        // Will be connected to navigation in Task 12
    }
}
