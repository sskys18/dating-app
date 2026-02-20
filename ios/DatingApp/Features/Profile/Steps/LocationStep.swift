import SwiftUI

struct LocationStep: View {
    @ObservedObject var viewModel: ProfileSetupViewModel
    @StateObject private var locationService = LocationService()
    @State private var useManualEntry = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Text("Your Location")
                    .font(.title2.bold())

                Text("We use your location to show you people nearby")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                // Detect location button
                Button {
                    Task {
                        try? await locationService.getCurrentLocation()
                        if let label = locationService.locationLabel {
                            viewModel.locationLabel = label
                            viewModel.latitude = locationService.latitude
                            viewModel.longitude = locationService.longitude
                        }
                    }
                } label: {
                    HStack {
                        Image(systemName: "location.fill")
                        Text(locationService.isLoading ? "Detecting..." : "Detect My Location")
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.pink.opacity(0.1))
                    .foregroundStyle(.pink)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .disabled(locationService.isLoading)

                // Show detected location
                if !viewModel.locationLabel.isEmpty && !useManualEntry {
                    HStack {
                        Image(systemName: "mappin.circle.fill")
                            .foregroundStyle(.pink)
                        Text(viewModel.locationLabel)
                            .font(.body)
                        Spacer()
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                    }
                    .padding()
                    .background(Color.green.opacity(0.05))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }

                // Manual entry toggle
                Button {
                    useManualEntry.toggle()
                } label: {
                    Text(useManualEntry ? "Use auto-detect instead" : "Enter manually instead")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                if useManualEntry {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("City")
                            .font(.subheadline.bold())
                        TextField("e.g. Seoul, South Korea", text: $viewModel.locationLabel)
                            .textFieldStyle(.roundedBorder)
                    }
                }

                if let error = locationService.error {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.red)
                }
            }
            .padding()
        }
    }
}
