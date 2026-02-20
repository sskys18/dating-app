import SwiftUI

struct MessageBubbleView: View {
    let message: ChatMessage
    let currentUserId: String

    private var isOwn: Bool {
        message.senderId == currentUserId || message.senderId == "me"
    }

    var body: some View {
        HStack {
            if isOwn { Spacer(minLength: 60) }

            VStack(alignment: isOwn ? .trailing : .leading, spacing: 2) {
                Text(message.content)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(isOwn ? Color.pink : Color(.systemGray5))
                    .foregroundStyle(isOwn ? .white : .primary)
                    .clipShape(RoundedRectangle(cornerRadius: 18))

                HStack(spacing: 4) {
                    Text(formatTime(message.createdAt))
                        .font(.caption2)
                        .foregroundStyle(.secondary)

                    if isOwn {
                        statusIcon
                    }
                }
            }

            if !isOwn { Spacer(minLength: 60) }
        }
        .padding(.horizontal, 16)
    }

    @ViewBuilder
    private var statusIcon: some View {
        switch message.status {
        case .sent:
            Image(systemName: "checkmark")
                .font(.caption2)
                .foregroundStyle(.secondary)
        case .delivered:
            Image(systemName: "checkmark.circle")
                .font(.caption2)
                .foregroundStyle(.secondary)
        case .read:
            Image(systemName: "checkmark.circle.fill")
                .font(.caption2)
                .foregroundStyle(.blue)
        }
    }

    private func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}
