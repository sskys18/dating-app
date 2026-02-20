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
                ProfileSetupPlaceholder()
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

struct ProfileSetupPlaceholder: View {
    var body: some View {
        Text("Profile Setup")
            .font(.title)
    }
}

struct MainTabView: View {
    var body: some View {
        TabView {
            FeedPlaceholder()
                .tabItem {
                    Label("Discover", systemImage: "heart.circle")
                }
            MatchesPlaceholder()
                .tabItem {
                    Label("Matches", systemImage: "message")
                }
            ProfilePlaceholder()
                .tabItem {
                    Label("Profile", systemImage: "person.circle")
                }
        }
        .tint(.pink)
    }
}

struct FeedPlaceholder: View {
    var body: some View {
        NavigationStack {
            Text("Feed")
                .navigationTitle("Discover")
        }
    }
}

struct MatchesPlaceholder: View {
    var body: some View {
        NavigationStack {
            Text("Matches & Chat")
                .navigationTitle("Matches")
        }
    }
}

struct ProfilePlaceholder: View {
    var body: some View {
        NavigationStack {
            Text("Profile")
                .navigationTitle("Profile")
        }
    }
}
