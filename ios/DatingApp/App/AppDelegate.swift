import UIKit
import UserNotifications

/// UIKit application delegate, bridged into SwiftUI via @UIApplicationDelegateAdaptor.
/// Exists so APNs device-token callbacks have a home: SwiftUI's App protocol does
/// not surface didRegisterForRemoteNotificationsWithDeviceToken.
class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        // Install the notification-center delegate as early as possible so taps on
        // notifications that launched the app are delivered to PushNotificationService.
        UNUserNotificationCenter.current().delegate = PushNotificationService.shared
        return true
    }

    // MARK: - APNs registration (REQ-PUSH-01)

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        // Hand the raw token to the service; it hex-encodes and POSTs to the backend.
        Task { @MainActor in
            await PushNotificationService.shared.registerDeviceToken(deviceToken)
        }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        print("[Push] APNs registration failed: \(error.localizedDescription)")
    }
}
