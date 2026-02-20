import SwiftUI

struct MatchAnimationOverlay: View {
    let matchedUser: MatchUser
    let chatRoomId: String?
    let onSendMessage: () -> Void
    let onKeepSwiping: () -> Void

    @State private var showContent = false

    var body: some View {
        ZStack {
            Color.black.opacity(0.8)
                .ignoresSafeArea()

            VStack(spacing: 32) {
                Spacer()

                Text("It's a Match!")
                    .font(.system(size: 36, weight: .bold))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [.pink, .orange],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )

                AsyncImage(url: URL(string: matchedUser.photoUrl)) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                    default:
                        Image(systemName: "person.circle.fill")
                            .resizable()
                            .foregroundStyle(.gray)
                    }
                }
                .frame(width: 120, height: 120)
                .clipShape(Circle())
                .overlay(Circle().stroke(.pink, lineWidth: 3))

                Text("You and \(matchedUser.nickname) liked each other!")
                    .font(.headline)
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.center)

                Spacer()

                VStack(spacing: 12) {
                    Button(action: onSendMessage) {
                        Text("Send Message")
                            .font(.headline)
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(.pink)
                            .clipShape(Capsule())
                    }

                    Button(action: onKeepSwiping) {
                        Text("Keep Swiping")
                            .font(.headline)
                            .foregroundStyle(.white.opacity(0.8))
                            .frame(maxWidth: .infinity)
                            .padding()
                    }
                }
                .padding(.horizontal, 32)
                .padding(.bottom, 48)
            }
            .scaleEffect(showContent ? 1 : 0.5)
            .opacity(showContent ? 1 : 0)
        }
        .onAppear {
            withAnimation(.spring(response: 0.5, dampingFraction: 0.7)) {
                showContent = true
            }
        }
    }
}
