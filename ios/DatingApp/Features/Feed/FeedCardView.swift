import SwiftUI

struct FeedCardView: View {
    let card: FeedCard
    let dragOffset: CGSize
    let likeOpacity: Double
    let passOpacity: Double

    var body: some View {
        ZStack(alignment: .bottom) {
            AsyncImage(url: URL(string: card.photoUrl)) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                case .failure:
                    Rectangle()
                        .fill(Color.gray.opacity(0.3))
                        .overlay {
                            Image(systemName: "person.fill")
                                .font(.system(size: 60))
                                .foregroundStyle(.gray)
                        }
                default:
                    Rectangle()
                        .fill(Color.gray.opacity(0.1))
                        .overlay { ProgressView() }
                }
            }
            .frame(width: UIScreen.main.bounds.width - 32, height: UIScreen.main.bounds.height * 0.6)
            .clipped()

            // Gradient overlay
            LinearGradient(
                colors: [.clear, .black.opacity(0.7)],
                startPoint: .center,
                endPoint: .bottom
            )

            // Card info
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .firstTextBaseline) {
                    Text(card.nickname)
                        .font(.title.bold())
                    Text("\(card.age)")
                        .font(.title2)
                }

                if let introLine = card.introLine, !introLine.isEmpty {
                    Text(introLine)
                        .font(.subheadline)
                        .lineLimit(2)
                }

                HStack(spacing: 12) {
                    if let location = card.locationLabel, !location.isEmpty {
                        Label(location, systemImage: "location.fill")
                            .font(.caption)
                    }

                    CompatibilityBadge(score: card.compatibilityScore)
                }

                if let typeLabel = card.typeLabel, !typeLabel.isEmpty {
                    Text(typeLabel)
                        .font(.caption)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(.ultraThinMaterial)
                        .clipShape(Capsule())
                }
            }
            .foregroundStyle(.white)
            .padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)

            // Like/Pass overlay indicators
            ZStack {
                Text("LIKE")
                    .font(.title.bold())
                    .foregroundStyle(.green)
                    .padding(8)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(.green, lineWidth: 3)
                    )
                    .rotationEffect(.degrees(-15))
                    .opacity(likeOpacity)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    .padding(30)

                Text("NOPE")
                    .font(.title.bold())
                    .foregroundStyle(.red)
                    .padding(8)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(.red, lineWidth: 3)
                    )
                    .rotationEffect(.degrees(15))
                    .opacity(passOpacity)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                    .padding(30)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(radius: 5)
    }
}

struct CompatibilityBadge: View {
    let score: Int

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "heart.fill")
                .font(.caption2)
            Text("\(score)%")
                .font(.caption.bold())
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(.pink.opacity(0.8))
        .clipShape(Capsule())
    }
}
