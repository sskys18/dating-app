import SwiftUI

@main
struct DatingAppApp: App {
    @StateObject private var appState = AppState()
    @StateObject private var authService = AuthService()

    var body: some Scene {
        WindowGroup {
            RootRouter()
                .environmentObject(appState)
                .environmentObject(authService)
                .onOpenURL { url in
                    DeepLinkHandler.shared.handle(url: url)
                }
        }
    }
}
