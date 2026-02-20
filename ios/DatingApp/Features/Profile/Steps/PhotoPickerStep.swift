import SwiftUI
import PhotosUI

struct PhotoPickerStep: View {
    @ObservedObject var viewModel: ProfileSetupViewModel
    @State private var selectedItem: PhotosPickerItem?
    @State private var activeSlot: Int = 0

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 12), count: 3)
    private let totalSlots = 6

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Add your photos")
                .font(.title2.bold())
                .padding(.horizontal)

            Text("Add at least 1 photo to continue")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .padding(.horizontal)

            LazyVGrid(columns: columns, spacing: 12) {
                ForEach(0..<totalSlots, id: \.self) { slot in
                    photoSlot(slot)
                        .aspectRatio(3/4, contentMode: .fit)
                }
            }
            .padding(.horizontal)

            Spacer()
        }
        .padding(.top)
        .onChange(of: selectedItem) { _, newItem in
            guard let item = newItem else { return }
            Task {
                if let data = try? await item.loadTransferable(type: Data.self) {
                    await viewModel.uploadPhoto(imageData: data, slot: activeSlot)
                }
                selectedItem = nil
            }
        }
    }

    @ViewBuilder
    private func photoSlot(_ slot: Int) -> some View {
        if slot < viewModel.photos.count {
            // Filled slot
            ZStack(alignment: .topTrailing) {
                AsyncImage(url: URL(string: viewModel.photos[slot].url)) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Color.gray.opacity(0.2)
                }
                .clipShape(RoundedRectangle(cornerRadius: 12))

                Button {
                    Task { await viewModel.removePhoto(at: slot) }
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.title3)
                        .foregroundStyle(.white, .black.opacity(0.6))
                }
                .padding(4)
            }
        } else if viewModel.uploadingSlot == slot {
            // Uploading slot
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.gray.opacity(0.1))
                .overlay {
                    ProgressView()
                }
        } else {
            // Empty slot
            PhotosPicker(selection: $selectedItem, matching: .images) {
                RoundedRectangle(cornerRadius: 12)
                    .strokeBorder(style: StrokeStyle(lineWidth: 2, dash: [6]))
                    .foregroundStyle(.gray.opacity(0.4))
                    .overlay {
                        Image(systemName: "plus")
                            .font(.title)
                            .foregroundStyle(.gray)
                    }
            }
            .simultaneousGesture(TapGesture().onEnded {
                activeSlot = slot
            })
        }
    }
}
