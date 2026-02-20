import SwiftUI

struct StarterSuggestionsView: View {
    let starters: [String]
    let onSelect: (String) -> Void

    var body: some View {
        if starters.isEmpty {
            VStack(spacing: 12) {
                Image(systemName: "bubble.left.and.bubble.right")
                    .font(.system(size: 40))
                    .foregroundStyle(.secondary)
                Text("Start the conversation!")
                    .font(.headline)
                    .foregroundStyle(.secondary)
            }
        } else {
            VStack(spacing: 12) {
                Text("Conversation starters")
                    .font(.subheadline.bold())
                    .foregroundStyle(.secondary)

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(starters, id: \.self) { starter in
                            Button {
                                onSelect(starter)
                            } label: {
                                Text(starter)
                                    .font(.subheadline)
                                    .padding(.horizontal, 14)
                                    .padding(.vertical, 10)
                                    .background(Color(.systemGray6))
                                    .clipShape(Capsule())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 16)
                }
            }
        }
    }
}
