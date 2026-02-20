import SwiftUI
import PhotosUI

struct ProfileEditView: View {
    @EnvironmentObject var appState: AppState
    @StateObject private var locationService = LocationService()

    @State private var photos: [UserPhoto] = []
    @State private var nickname = ""
    @State private var bio = ""
    @State private var introLine = ""
    @State private var locationLabel = ""
    @State private var typeVisible = false
    @State private var axisCVisible = false
    @State private var isSaving = false
    @State private var error: String?
    @State private var selectedPhotoItem: PhotosPickerItem?

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 12), count: 3)
    private let totalSlots = 6

    var body: some View {
        Form {
            // Photos section
            Section("Photos") {
                LazyVGrid(columns: columns, spacing: 12) {
                    ForEach(0..<totalSlots, id: \.self) { slot in
                        photoSlot(slot)
                            .aspectRatio(3/4, contentMode: .fit)
                    }
                }
                .padding(.vertical, 4)
            }

            // Basic info
            Section("Basic Info") {
                TextField("Nickname", text: $nickname)
                TextField("Intro Line", text: $introLine)
            }

            Section("Bio") {
                TextEditor(text: $bio)
                    .frame(minHeight: 80)
            }

            // Location
            Section("Location") {
                HStack {
                    TextField("City", text: $locationLabel)
                    Button {
                        Task {
                            try? await locationService.getCurrentLocation()
                            if let label = locationService.locationLabel {
                                locationLabel = label
                            }
                        }
                    } label: {
                        Image(systemName: "location.fill")
                            .foregroundStyle(.pink)
                    }
                    .disabled(locationService.isLoading)
                }
            }

            // Visibility
            Section("Visibility") {
                Toggle("Show Personality Type", isOn: $typeVisible)
                Toggle("Show Axis-C Score", isOn: $axisCVisible)
            }

            // Save
            Section {
                Button {
                    Task { await saveProfile() }
                } label: {
                    HStack {
                        Spacer()
                        if isSaving {
                            ProgressView()
                        } else {
                            Text("Save Changes")
                                .bold()
                        }
                        Spacer()
                    }
                }
                .disabled(isSaving)
            }
        }
        .navigationTitle("Edit Profile")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { loadFromProfile() }
        .onChange(of: selectedPhotoItem) { _, newItem in
            guard let item = newItem else { return }
            Task {
                if let data = try? await item.loadTransferable(type: Data.self) {
                    do {
                        let photo = try await PhotoUploadService.shared.upload(
                            imageData: data,
                            filename: "photo_\(photos.count).jpg",
                            contentType: "image/jpeg"
                        )
                        photos.append(photo)
                    } catch {
                        self.error = error.localizedDescription
                    }
                }
                selectedPhotoItem = nil
            }
        }
        .alert("Error", isPresented: .init(
            get: { error != nil },
            set: { if !$0 { error = nil } }
        )) {
            Button("OK") { error = nil }
        } message: {
            Text(error ?? "")
        }
    }

    @ViewBuilder
    private func photoSlot(_ slot: Int) -> some View {
        if slot < photos.count {
            ZStack(alignment: .topTrailing) {
                AsyncImage(url: URL(string: photos[slot].url)) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Color.gray.opacity(0.2)
                }
                .clipShape(RoundedRectangle(cornerRadius: 8))

                Button {
                    Task {
                        let photoId = photos[slot].id
                        do {
                            try await PhotoUploadService.shared.delete(photoId: photoId)
                            photos.remove(at: slot)
                        } catch {
                            self.error = error.localizedDescription
                        }
                    }
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.white, .black.opacity(0.6))
                }
                .padding(2)
            }
        } else {
            PhotosPicker(selection: $selectedPhotoItem, matching: .images) {
                RoundedRectangle(cornerRadius: 8)
                    .strokeBorder(style: StrokeStyle(lineWidth: 1, dash: [4]))
                    .foregroundStyle(.gray.opacity(0.4))
                    .overlay {
                        Image(systemName: "plus")
                            .foregroundStyle(.gray)
                    }
            }
        }
    }

    private func loadFromProfile() {
        guard let profile = appState.userProfile else { return }
        photos = profile.photos
        nickname = profile.nickname ?? ""
        bio = profile.bio ?? ""
        introLine = profile.introLine ?? ""
        locationLabel = profile.locationLabel ?? ""
        typeVisible = profile.typeVisible
        axisCVisible = profile.axisCVisible
    }

    private func saveProfile() async {
        isSaving = true
        error = nil

        defer { isSaving = false }

        let body = UpdateProfileRequest(
            nickname: nickname,
            bio: bio.isEmpty ? nil : bio,
            introLine: introLine.isEmpty ? nil : introLine,
            locationLat: locationService.latitude,
            locationLng: locationService.longitude,
            locationLabel: locationLabel.isEmpty ? nil : locationLabel,
            typeVisible: typeVisible,
            axisCVisible: axisCVisible
        )

        // Reorder photos if needed
        if !photos.isEmpty {
            let ids = photos.map { $0.id }
            try? await PhotoUploadService.shared.reorder(photoIds: ids)
        }

        do {
            let updated: UserProfile = try await APIClient.shared.request(
                method: "PATCH",
                path: "/profile/me",
                body: body
            )
            appState.userProfile = updated
        } catch {
            self.error = error.localizedDescription
        }
    }
}
