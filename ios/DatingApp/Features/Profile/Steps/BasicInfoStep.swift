import SwiftUI

struct BasicInfoStep: View {
    @ObservedObject var viewModel: ProfileSetupViewModel

    private let genderOptions = ["Man", "Woman", "Non-binary", "Other"]

    private var minDate: Date {
        Calendar.current.date(byAdding: .year, value: -100, to: Date()) ?? Date()
    }

    private var maxDate: Date {
        Calendar.current.date(byAdding: .year, value: -18, to: Date()) ?? Date()
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Text("Basic Info")
                    .font(.title2.bold())

                VStack(alignment: .leading, spacing: 8) {
                    Text("Nickname")
                        .font(.subheadline.bold())
                    TextField("What should people call you?", text: $viewModel.nickname)
                        .textFieldStyle(.roundedBorder)
                        .textContentType(.nickname)
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("Birth Date")
                        .font(.subheadline.bold())
                    DatePicker(
                        "Birth Date",
                        selection: $viewModel.birthDate,
                        in: minDate...maxDate,
                        displayedComponents: .date
                    )
                    .datePickerStyle(.compact)
                    .labelsHidden()

                    Text("You must be at least 18 years old")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("Gender")
                        .font(.subheadline.bold())
                    Picker("Gender", selection: $viewModel.gender) {
                        Text("Select").tag("")
                        ForEach(genderOptions, id: \.self) { option in
                            Text(option).tag(option)
                        }
                    }
                    .pickerStyle(.segmented)
                }
            }
            .padding()
        }
    }
}
