import SwiftUI

struct IntroLineStep: View {
    @ObservedObject var viewModel: ProfileSetupViewModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Text("Introduce Yourself")
                    .font(.title2.bold())

                VStack(alignment: .leading, spacing: 8) {
                    Text("Intro Line")
                        .font(.subheadline.bold())
                    Text("A short tagline shown on your card")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    TextField("e.g. Coffee lover and weekend hiker", text: $viewModel.introLine)
                        .textFieldStyle(.roundedBorder)
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("Bio")
                        .font(.subheadline.bold())
                    Text("Tell people more about yourself")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    // Draft bio variant chips
                    if !viewModel.draftBioVariants.isEmpty {
                        Text("Suggested bios")
                            .font(.caption)
                            .foregroundStyle(.secondary)

                        FlowLayout(spacing: 8) {
                            ForEach(viewModel.draftBioVariants, id: \.self) { variant in
                                Button {
                                    viewModel.bio = variant
                                } label: {
                                    Text(variant)
                                        .font(.caption)
                                        .lineLimit(2)
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 8)
                                        .background(
                                            viewModel.bio == variant
                                                ? Color.pink.opacity(0.2)
                                                : Color.gray.opacity(0.1)
                                        )
                                        .foregroundStyle(viewModel.bio == variant ? .pink : .primary)
                                        .clipShape(RoundedRectangle(cornerRadius: 8))
                                }
                            }
                        }
                    }

                    TextEditor(text: $viewModel.bio)
                        .frame(minHeight: 120)
                        .padding(4)
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                        )
                }
            }
            .padding()
        }
    }
}

// MARK: - Flow Layout for chips

struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = arrange(proposal: proposal, subviews: subviews)
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = arrange(proposal: proposal, subviews: subviews)
        for (index, position) in result.positions.enumerated() {
            subviews[index].place(
                at: CGPoint(x: bounds.minX + position.x, y: bounds.minY + position.y),
                proposal: .unspecified
            )
        }
    }

    private func arrange(proposal: ProposedViewSize, subviews: Subviews) -> (positions: [CGPoint], size: CGSize) {
        let maxWidth = proposal.width ?? .infinity
        var positions: [CGPoint] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var totalHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > maxWidth && x > 0 {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            positions.append(CGPoint(x: x, y: y))
            rowHeight = max(rowHeight, size.height)
            x += size.width + spacing
            totalHeight = y + rowHeight
        }

        return (positions, CGSize(width: maxWidth, height: totalHeight))
    }
}
