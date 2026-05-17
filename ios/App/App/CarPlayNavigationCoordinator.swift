// CarPlayNavigationCoordinator.swift
//
// Singleton bridge between the CarPlay scene and the Roam backend nav APIs.
// The CarPlay scene calls in here for routing, hazard polling, elevation,
// traffic; this class issues HTTP requests via URLSession against the same
// endpoints the phone-app TS layer hits (see src/lib/api/nav.ts for the
// contract). Implementation pass replaces the stubs with real fetches.
//
// Endpoint base URL is read at runtime so dev/staging/prod can swap.
// Default points at the production backend; override via Info.plist key
// "RoamApiBaseURL" if a dev needs to point at a local FastAPI.

import CarPlay
import Foundation
import MapKit

@available(iOS 14.0, *)
final class CarPlayNavigationCoordinator: NSObject {

    static let shared = CarPlayNavigationCoordinator()

    private(set) var isSceneConnected = false
    private(set) var activeNavigationSession: CPNavigationSession?
    private(set) var activeMapTemplate: CPMapTemplate?

    private lazy var apiBaseURL: URL = {
        let key = "RoamApiBaseURL"
        if let raw = Bundle.main.object(forInfoDictionaryKey: key) as? String,
           let url = URL(string: raw) {
            return url
        }
        // Default production backend.
        return URL(string: "https://api.roam.ecodia.au")!
    }()

    private lazy var session: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 120
        config.waitsForConnectivity = false
        return URLSession(configuration: config)
    }()

    // ---------------------------------------------------------------------
    // Lifecycle
    // ---------------------------------------------------------------------

    func sceneDidConnect() {
        isSceneConnected = true
    }

    func sceneDidDisconnect() {
        isSceneConnected = false
        activeNavigationSession?.cancelTrip()
        activeNavigationSession = nil
        activeMapTemplate = nil
    }

    // ---------------------------------------------------------------------
    // Backend nav surface (matches src/lib/api/nav.ts)
    // ---------------------------------------------------------------------

    struct RouteRequest: Codable {
        let originLat: Double
        let originLng: Double
        let destLat: Double
        let destLng: Double
        let profile: String

        enum CodingKeys: String, CodingKey {
            case originLat = "origin_lat"
            case originLng = "origin_lng"
            case destLat = "dest_lat"
            case destLng = "dest_lng"
            case profile
        }
    }

    struct NavPackResponse: Codable {
        let routeKey: String
        let geometryPolyline6: String
        let distanceMeters: Double
        let durationSeconds: Double

        enum CodingKeys: String, CodingKey {
            case routeKey = "route_key"
            case geometryPolyline6 = "geometry_polyline6"
            case distanceMeters = "distance_meters"
            case durationSeconds = "duration_seconds"
        }
    }

    // POST /nav/route. Stub: implementation pass wires real request body
    // from the Capacitor app's offline bundle or live call.
    func requestRoute(_ req: RouteRequest) async throws -> NavPackResponse {
        let url = apiBaseURL.appendingPathComponent("nav/route")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(req)
        let (data, _) = try await session.data(for: request)
        return try JSONDecoder().decode(NavPackResponse.self, from: data)
    }

    // POST /nav/hazards/poll. Returns raw JSON for the implementation pass to map.
    func pollHazards(bbox: [Double], sources: [String] = []) async throws -> Data {
        let url = apiBaseURL.appendingPathComponent("nav/hazards/poll")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body: [String: Any] = ["bbox": bbox, "sources": sources]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, _) = try await session.data(for: request)
        return data
    }

    // POST /nav/traffic/poll. Returns raw JSON for the implementation pass to map.
    func pollTraffic(bbox: [Double]) async throws -> Data {
        let url = apiBaseURL.appendingPathComponent("nav/traffic/poll")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body: [String: Any] = ["bbox": bbox]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, _) = try await session.data(for: request)
        return data
    }

    // ---------------------------------------------------------------------
    // Polyline6 decode (used by CarPlayMapViewController to draw the route)
    // Algorithm mirrors Mapbox polyline-codec (precision 6).
    // ---------------------------------------------------------------------

    static func decodePolyline6(_ encoded: String) -> [CLLocationCoordinate2D] {
        var coords: [CLLocationCoordinate2D] = []
        let chars = Array(encoded)
        var index = 0
        var lat = 0, lng = 0
        while index < chars.count {
            var b: Int = 0, shift = 0, result = 0
            repeat {
                guard index < chars.count else { break }
                b = Int(chars[index].asciiValue ?? 0) - 63
                index += 1
                result |= (b & 0x1f) << shift
                shift += 5
            } while b >= 0x20
            let dlat = ((result & 1) != 0) ? ~(result >> 1) : (result >> 1)
            lat += dlat

            shift = 0; result = 0
            repeat {
                guard index < chars.count else { break }
                b = Int(chars[index].asciiValue ?? 0) - 63
                index += 1
                result |= (b & 0x1f) << shift
                shift += 5
            } while b >= 0x20
            let dlng = ((result & 1) != 0) ? ~(result >> 1) : (result >> 1)
            lng += dlng

            coords.append(CLLocationCoordinate2D(
                latitude: Double(lat) / 1e6,
                longitude: Double(lng) / 1e6
            ))
        }
        return coords
    }
}

// CPMapTemplateDelegate stub. Implementation pass populates the trip card,
// maneuver updates, and panning callbacks.
@available(iOS 14.0, *)
extension CarPlayNavigationCoordinator: CPMapTemplateDelegate {
    func mapTemplateDidShowPanningInterface(_ mapTemplate: CPMapTemplate) {}
    func mapTemplateDidDismissPanningInterface(_ mapTemplate: CPMapTemplate) {}
}

// CPSearchTemplateDelegate stub. Implementation pass wires to
// the Roam places search backend.
@available(iOS 14.0, *)
extension CarPlayNavigationCoordinator: CPSearchTemplateDelegate {
    func searchTemplate(
        _ searchTemplate: CPSearchTemplate,
        updatedSearchText searchText: String,
        completionHandler: @escaping ([CPListItem]) -> Void
    ) {
        // Stub: return empty until implementation pass.
        completionHandler([])
    }

    func searchTemplate(
        _ searchTemplate: CPSearchTemplate,
        selectedResult item: CPListItem,
        completionHandler: @escaping () -> Void
    ) {
        // Stub: implementation pass starts a CPNavigationSession.
        completionHandler()
    }
}
