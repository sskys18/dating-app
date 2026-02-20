import SwiftUI

struct ReviewStep: View {
    @ObservedObject var viewModel: ProfileSetupViewModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Text("Review Your Profile")
                    .font(.title2.bold())

                // Primary photo
                if let primaryPhoto = viewModel.photos.first {
                    AsyncImage(url: URL(string: primaryPhoto.url)) { image in
                        image
                            .resizable()
                            .scaledToFill()
                    } placeholder: {
                        Color.gray.opacity(0.2)
                    }
                    .frame(height: 300)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                }

                // Info summary
                VStack(alignment: .leading, spacing: 12) {
                    reviewRow("Nickname", value: viewModel.nickname)
                    reviewRow("Gender", value: viewModel.gender)
                    reviewRow("Birth Date", value: formattedDate)
                    reviewRow("Location", value: viewModel.locationLabel)

                    if !viewModel.introLine.isEmpty {
                        reviewRow("Intro", value: viewModel.introLine)
                    }

                    if !viewModel.bio.isEmpty {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Bio")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                            Text(viewModel.bio)
                                .font(.body)
                        }
                    }

                    reviewRow("Photos", value: "\(viewModel.photos.count) uploaded")
                }
                .padding()
                .background(Color.gray.opacity(0.05))
                .clipShape(RoundedRectangle(cornerRadius: 12))

                if viewModel.isLoading {
                    ProgressView("Saving...")
                        .frame(maxWidth: .infinity)
                }
            }
            .padding()
        }
    }

    private func reviewRow(_ label: String, value: String) -> some View {
        HStack {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .font(.body)
        }
    }

    private var formattedDate: String {
        viewModel.birthDate.formatted(date: .abbreviated, time: .omitted)
    }
}
