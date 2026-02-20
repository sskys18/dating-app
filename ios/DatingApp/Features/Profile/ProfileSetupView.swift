import SwiftUI

struct ProfileSetupView: View {
    @StateObject private var viewModel = ProfileSetupViewModel()
    @EnvironmentObject var appState: AppState

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Progress indicator
                ProgressView(value: Double(viewModel.stepNumber), total: Double(viewModel.totalSteps))
                    .tint(.pink)
                    .padding(.horizontal)

                Text("Step \(viewModel.stepNumber) of \(viewModel.totalSteps)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.top, 4)

                // Content
                Group {
                    switch viewModel.currentStep {
                    case .photos:
                        PhotoPickerStep(viewModel: viewModel)
                    case .basicInfo:
                        BasicInfoStep(viewModel: viewModel)
                    case .location:
                        LocationStep(viewModel: viewModel)
                    case .introLine:
                        IntroLineStep(viewModel: viewModel)
                    case .review:
                        ReviewStep(viewModel: viewModel)
                    }
                }
                .frame(maxHeight: .infinity)

                // Navigation buttons
                HStack(spacing: 16) {
                    if !viewModel.isFirstStep {
                        Button("Back") {
                            viewModel.previousStep()
                        }
                        .buttonStyle(.bordered)
                    }

                    Spacer()

                    if viewModel.isLastStep {
                        Button("Complete Profile") {
                            Task {
                                let success = await viewModel.submitProfile()
                                if success {
                                    appState.isProfileComplete = true
                                    appState.resolveRoute()
                                }
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.pink)
                        .disabled(viewModel.isLoading)
                    } else {
                        Button("Next") {
                            viewModel.nextStep()
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.pink)
                        .disabled(!viewModel.canProceedFromCurrentStep)
                    }
                }
                .padding()
            }
            .navigationTitle("Set Up Profile")
            .navigationBarTitleDisplayMode(.inline)
            .alert("Error", isPresented: .init(
                get: { viewModel.error != nil },
                set: { if !$0 { viewModel.error = nil } }
            )) {
                Button("OK") { viewModel.error = nil }
            } message: {
                Text(viewModel.error ?? "")
            }
            .task {
                await viewModel.loadExistingProfile()
                await viewModel.loadDrafts()
            }
        }
    }
}
