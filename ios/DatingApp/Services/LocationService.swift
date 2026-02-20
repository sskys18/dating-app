import CoreLocation
import SwiftUI

@MainActor
class LocationService: NSObject, ObservableObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    private let geocoder = CLGeocoder()

    @Published var authorizationStatus: CLAuthorizationStatus = .notDetermined
    @Published var locationLabel: String?
    @Published var latitude: Double?
    @Published var longitude: Double?
    @Published var isLoading = false
    @Published var error: String?

    private var locationContinuation: CheckedContinuation<CLLocation, Error>?

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyKilometer
        authorizationStatus = manager.authorizationStatus
    }

    func requestPermission() {
        manager.requestWhenInUseAuthorization()
    }

    func getCurrentLocation() async throws {
        isLoading = true
        error = nil

        defer { isLoading = false }

        if authorizationStatus == .notDetermined {
            requestPermission()
            // Wait briefly for authorization response
            try await Task.sleep(for: .seconds(1))
        }

        guard authorizationStatus == .authorizedWhenInUse || authorizationStatus == .authorizedAlways else {
            error = "Location permission not granted"
            throw LocationError.permissionDenied
        }

        let location = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<CLLocation, Error>) in
            locationContinuation = continuation
            manager.requestLocation()
        }

        latitude = location.coordinate.latitude
        longitude = location.coordinate.longitude

        // Reverse geocode for city label
        do {
            let placemarks = try await geocoder.reverseGeocodeLocation(location)
            if let placemark = placemarks.first {
                let components = [placemark.locality, placemark.administrativeArea].compactMap { $0 }
                locationLabel = components.joined(separator: ", ")
            }
        } catch {
            // Geocoding failure is non-fatal; coordinates are still available
            locationLabel = nil
        }
    }

    // MARK: - CLLocationManagerDelegate

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        Task { @MainActor in
            locationContinuation?.resume(returning: location)
            locationContinuation = nil
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in
            self.error = error.localizedDescription
            locationContinuation?.resume(throwing: error)
            locationContinuation = nil
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in
            authorizationStatus = manager.authorizationStatus
        }
    }
}

enum LocationError: Error, LocalizedError {
    case permissionDenied

    var errorDescription: String? {
        switch self {
        case .permissionDenied:
            return "Location permission was not granted"
        }
    }
}
