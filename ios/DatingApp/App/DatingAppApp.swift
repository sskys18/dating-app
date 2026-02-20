import SwiftUI

@main
struct DatingAppApp: App {
    @StateObject private var appState = AppState()
    @StateObject private var authService = AuthService()
    @StateObject private var deepLinkHandler = DeepLinkHandler.shared

    var body: some Scene {
        WindowGroup {
            RootRouter()
                .environmentObject(appState)
                .environmentObject(authService)
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
                    appState.resolveRoute()
                }
        }
    }
}
