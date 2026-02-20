import SwiftUI

struct RootRouter: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var authService: AuthService

    var body: some View {
        Group {
            switch appState.currentRoute {
            case .splash:
                SplashView()
            case .auth:
                AuthView()
            case .handoffClaim(let token):
                HandoffClaimView(token: token)
            case .profileSetup:
                ProfileSetupView()
            case .main:
                MainTabView()
            }
        }
        .animation(.easeInOut, value: appState.currentRoute == .main)
    }
}

// MARK: - Placeholder Views

struct SplashView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "heart.fill")
                .font(.system(size: 64))
                .foregroundStyle(.pink)
            Text("Dating App")
                .font(.largeTitle.bold())
        }
        .task {
            try? await Task.sleep(for: .seconds(1))
            appState.resolveRoute()
        }
    }
}

struct MainTabView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        TabView {
            FeedView()
                .tabItem {
                    Label("Discover", systemImage: "heart.circle")
                }
            MatchListView()
                .tabItem {
                    Label("Matches", systemImage: "message")
                }
                .badge(appState.totalUnreadMessages)
            ProfileTabView()
                .tabItem {
                    Label("Profile", systemImage: "person.circle")
                }
        }
        .tint(.pink)
    }
}
