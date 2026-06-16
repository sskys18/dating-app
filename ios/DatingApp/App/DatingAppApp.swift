import SwiftUI

@main
struct DatingAppApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    @StateObject private var appState = AppState()
    @StateObject private var authService = AuthService()
    @StateObject private var deepLinkHandler = DeepLinkHandler.shared
    @StateObject private var subscriptionService = SubscriptionService()
    @StateObject private var entitlementService = EntitlementService()
    @StateObject private var feedService = FeedService()
    @StateObject private var matchService = MatchService()
    @StateObject private var blockService = BlockService()
    @StateObject private var webSocketService = WebSocketService()
    // Shared instance so AppDelegate's APNs callbacks and this view both use one object.
    @StateObject private var pushNotificationService = PushNotificationService.shared

    var body: some Scene {
        WindowGroup {
            RootRouter()
                .environmentObject(appState)
                .environmentObject(authService)
                .environmentObject(subscriptionService)
                .environmentObject(entitlementService)
                .environmentObject(feedService)
                .environmentObject(matchService)
                .environmentObject(blockService)
                .environmentObject(webSocketService)
                .environmentObject(pushNotificationService)
                .onOpenURL { url in
                    deepLinkHandler.handle(url: url)
                }
                .onReceive(deepLinkHandler.$pendingHandoffToken) { token in
                    guard let token = token else { return }
                    if authService.isAuthenticated {
                        appState.pendingHandoffToken = token
                        appState.resolveRoute()
                    } else {
                        appState.pendingHandoffToken = token
                        appState.currentRoute = .auth
                    }
                }
                .task {
                    await authService.checkExistingSession()
                    appState.isAuthenticated = authService.isAuthenticated
                    entitlementService.loadCached()
                    subscriptionService.listenForTransactionUpdates()
                    // Link the push service to app state so taps can navigate and
                    // the badge fallback can read the match list (REQ-PUSH-01/02).
                    pushNotificationService.appState = appState
                    pushNotificationService.matchService = matchService
                    pushNotificationService.requestPermission()
                    if authService.isAuthenticated {
                        await webSocketService.connect()
                        // REQ-PUSH-02: seed in-app badges from the match list so the
                        // tab badge is correct regardless of push authorization.
                        await pushNotificationService.refreshUnreadFallback()
                    }
                    appState.resolveRoute()
                }
        }
    }
}
