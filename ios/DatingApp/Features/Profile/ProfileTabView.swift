import SwiftUI

struct ProfileTabView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var authService: AuthService
    @EnvironmentObject var entitlementService: EntitlementService

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    // Header: photo + name + age
                    profileHeader

                    // Type label
                    if let profile = appState.userProfile, profile.typeVisible, let typeId = profile.typeId {
                        HStack {
                            Image(systemName: "person.text.rectangle")
                                .foregroundStyle(.pink)
                            Text("Type \(typeId)")
                                .font(.subheadline)
                        }
                        .padding()
                        .frame(maxWidth: .infinity)
                        .background(Color.pink.opacity(0.05))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .padding(.horizontal)
                    }

                    // Subscription card
                    subscriptionCard

                    // Edit Profile
                    NavigationLink {
                        ProfileEditView()
                    } label: {
                        HStack {
                            Image(systemName: "pencil")
                            Text("Edit Profile")
                            Spacer()
                            Image(systemName: "chevron.right")
                                .foregroundStyle(.secondary)
                        }
                        .padding()
                        .background(Color.gray.opacity(0.05))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .foregroundStyle(.primary)
                    .padding(.horizontal)

                    // Logout
                    Button(role: .destructive) {
                        Task {
                            await authService.logout()
                            appState.isAuthenticated = false
                            appState.resolveRoute()
                        }
                    } label: {
                        HStack {
                            Image(systemName: "rectangle.portrait.and.arrow.right")
                            Text("Log Out")
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                    }
                    .padding(.horizontal)
                }
                .padding(.vertical)
            }
            .navigationTitle("Profile")
            .task {
                await loadProfile()
            }
        }
    }

    private var profileHeader: some View {
        VStack(spacing: 12) {
            if let photo = appState.userProfile?.photos.first {
                AsyncImage(url: URL(string: photo.url)) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Circle().fill(Color.gray.opacity(0.2))
                }
                .frame(width: 100, height: 100)
                .clipShape(Circle())
            } else {
                Circle()
                    .fill(Color.gray.opacity(0.2))
                    .frame(width: 100, height: 100)
                    .overlay {
                        Image(systemName: "person.fill")
                            .font(.largeTitle)
                            .foregroundStyle(.gray)
                    }
            }

            HStack(spacing: 4) {
                Text(appState.userProfile?.nickname ?? "")
                    .font(.title2.bold())
                if let age = appState.userProfile?.age {
                    Text(", \(age)")
                        .font(.title2)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    private var subscriptionCard: some View {
        NavigationLink {
            PaywallView()
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Current Plan")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(entitlementService.entitlement.plan.rawValue.capitalized)
                        .font(.headline)
                        .foregroundStyle(planColor)
                }
                Spacer()
                Text("Upgrade")
                    .font(.subheadline.bold())
                    .foregroundStyle(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(Color.pink)
                    .clipShape(Capsule())
            }
            .padding()
            .background(Color.gray.opacity(0.05))
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .foregroundStyle(.primary)
        .padding(.horizontal)
    }

    private var planColor: Color {
        switch entitlementService.entitlement.plan {
        case .free: return .gray
        case .plus: return .blue
        case .premium: return .purple
        }
    }

    private func loadProfile() async {
        do {
            let profile: UserProfile = try await APIClient.shared.get(path: "/profile/me")
            appState.userProfile = profile
        } catch {
            // Profile load failed
        }
    }
}
