import SwiftUI

struct MatchRowView: View {
    let match: MatchListItem

    var body: some View {
        HStack(spacing: 12) {
            AsyncImage(url: URL(string: match.otherUser.photoUrl)) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().aspectRatio(contentMode: .fill)
                default:
                    Image(systemName: "person.circle.fill")
                        .resizable()
                        .foregroundStyle(.gray)
                }
            }
            .frame(width: 50, height: 50)
            .clipShape(Circle())

            VStack(alignment: .leading, spacing: 4) {
                Text(match.otherUser.nickname)
                    .font(.headline)

                if let lastMessage = match.lastMessage {
                    Text(lastMessage.content)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                if let lastMessage = match.lastMessage {
                    Text(timeAgo(lastMessage.createdAt))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                if match.unreadCount > 0 {
                    Circle()
                        .fill(.blue)
                        .frame(width: 10, height: 10)
                }
            }
        }
        .padding(.vertical, 4)
    }

    private func timeAgo(_ date: Date) -> String {
        let interval = Date().timeIntervalSince(date)
        if interval < 60 { return "now" }
        if interval < 3600 { return "\(Int(interval / 60))m" }
        if interval < 86400 { return "\(Int(interval / 3600))h" }
        return "\(Int(interval / 86400))d"
    }
}
