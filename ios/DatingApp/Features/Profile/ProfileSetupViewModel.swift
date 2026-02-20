import SwiftUI

enum ProfileSetupStep: Int, CaseIterable {
    case photos
    case basicInfo
    case location
    case introLine
    case review
}

@MainActor
class ProfileSetupViewModel: ObservableObject {
    @Published var currentStep: ProfileSetupStep = .photos
    @Published var photos: [UserPhoto] = []
    @Published var nickname = ""
    @Published var birthDate = Calendar.current.date(byAdding: .year, value: -18, to: Date()) ?? Date()
    @Published var gender = ""
    @Published var introLine = ""
    @Published var bio = ""
    @Published var locationLabel = ""
    @Published var latitude: Double?
    @Published var longitude: Double?
    @Published var draftBioVariants: [String] = []
    @Published var isLoading = false
    @Published var error: String?
    @Published var uploadingSlot: Int?

    private let genderOptions = ["Man", "Woman", "Non-binary", "Other"]

    struct DraftResponse: Decodable {
        let bioVariants: [String]?
        let promptAnswers: [String: String]?
    }

    func loadExistingProfile() async {
        do {
            let profile: UserProfile = try await APIClient.shared.get(path: "/profile/me")
            nickname = profile.nickname ?? ""
            gender = profile.gender ?? ""
            bio = profile.bio ?? ""
            introLine = profile.introLine ?? ""
            locationLabel = profile.locationLabel ?? ""
            photos = profile.photos
        } catch {
            // New profile — start fresh
        }
    }

    func loadDrafts() async {
        do {
            let drafts: DraftResponse = try await APIClient.shared.get(path: "/profile/drafts")
            draftBioVariants = drafts.bioVariants ?? []
        } catch {
            // No drafts available
        }
    }

    func uploadPhoto(imageData: Data, slot: Int) async {
        uploadingSlot = slot
        do {
            let photo = try await PhotoUploadService.shared.upload(
                imageData: imageData,
                filename: "photo_\(slot).jpg",
                contentType: "image/jpeg"
            )
            photos.append(photo)
        } catch {
            self.error = "Failed to upload photo: \(error.localizedDescription)"
        }
        uploadingSlot = nil
    }

    func removePhoto(at index: Int) async {
        guard index < photos.count else { return }
        let photo = photos[index]
        do {
            try await PhotoUploadService.shared.delete(photoId: photo.id)
            photos.remove(at: index)
        } catch {
            self.error = "Failed to delete photo: \(error.localizedDescription)"
        }
    }

    func submitProfile() async -> Bool {
        isLoading = true
        error = nil

        defer { isLoading = false }

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]

        let body = UpdateProfileRequest(
            nickname: nickname,
            birthDate: formatter.string(from: birthDate),
            gender: gender,
            bio: bio.isEmpty ? nil : bio,
            introLine: introLine.isEmpty ? nil : introLine,
            locationLat: latitude,
            locationLng: longitude,
            locationLabel: locationLabel.isEmpty ? nil : locationLabel
        )

        do {
            let _: UserProfile = try await APIClient.shared.request(
                method: "PATCH",
                path: "/profile/me",
                body: body
            )
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    var canProceedFromCurrentStep: Bool {
        switch currentStep {
        case .photos:
            return !photos.isEmpty
        case .basicInfo:
            return !nickname.isEmpty && !gender.isEmpty
        case .location:
            return !locationLabel.isEmpty
        case .introLine:
            return true
        case .review:
            return true
        }
    }

    func nextStep() {
        guard let nextIndex = ProfileSetupStep(rawValue: currentStep.rawValue + 1) else { return }
        currentStep = nextIndex
    }

    func previousStep() {
        guard let prevIndex = ProfileSetupStep(rawValue: currentStep.rawValue - 1) else { return }
        currentStep = prevIndex
    }

    var isFirstStep: Bool { currentStep == .photos }
    var isLastStep: Bool { currentStep == .review }
    var stepNumber: Int { currentStep.rawValue + 1 }
    var totalSteps: Int { ProfileSetupStep.allCases.count }
}
