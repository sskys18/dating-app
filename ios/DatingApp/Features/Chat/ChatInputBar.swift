import SwiftUI

struct ChatInputBar: View {
    @Binding var text: String
    let onSend: () -> Void
    let onTypingChanged: (Bool) -> Void

    private let maxCharacters = 2000

    var body: some View {
        VStack(spacing: 0) {
            Divider()
            HStack(alignment: .bottom, spacing: 8) {
                TextField("Message...", text: $text, axis: .vertical)
                    .textFieldStyle(.plain)
                    .lineLimit(1...5)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Color(.systemGray6))
                    .clipShape(RoundedRectangle(cornerRadius: 20))
                    .onChange(of: text) { _, newValue in
                        onTypingChanged(!newValue.isEmpty)
                        if newValue.count > maxCharacters {
                            text = String(newValue.prefix(maxCharacters))
                        }
                    }

                Button(action: onSend) {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.title2)
                        .foregroundStyle(.pink)
                }
                .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)

            if text.count > maxCharacters - 200 {
                Text("\(text.count)/\(maxCharacters)")
                    .font(.caption2)
                    .foregroundStyle(text.count >= maxCharacters ? .red : .secondary)
                    .frame(maxWidth: .infinity, alignment: .trailing)
                    .padding(.trailing, 16)
                    .padding(.bottom, 4)
            }
        }
        .background(.bar)
    }
}
