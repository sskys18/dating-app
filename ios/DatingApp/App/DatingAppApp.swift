import SwiftUI

@main
struct DatingAppApp: App {
    @StateObject private var appState = AppState()
    @StateObject private var authService = AuthService()
    @StateObject private var deepLinkHandler = DeepLinkHandler.shared
    @StateObject private var subscriptionService = SubscriptionService()
    @StateObject private var entitlementService = EntitlementService()
    @StateObject private var feedService = FeedService()
    @StateObject private var matchService = MatchService()
    @StateObject private var blockService = BlockService()
    @StateObject private var webSocketService = WebSocketService()
    @StateObject private var pushNotificationService = PushNotificationService()

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
                    pushNotificationService.requestPermission()
                    if authService.isAuthenticated {
                        await webSocketService.connect()
                    }
                    appState.resolveRoute()
                }
        }
    }
}
