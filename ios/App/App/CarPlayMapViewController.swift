// CarPlayMapViewController.swift
//
// MKMapView host for the CarPlay scene. v1.1 uses Apple's MapKit because
// it is the only map renderer Apple ships with first-class CarPlay support
// out of the box. v1.2 may swap for MapLibre native if there is a strong
// reason (custom outback tile styling); for now the goal is to land the
// scaffold without that complexity.
//
// This view controller is set as the carWindow's rootViewController by
// CarPlaySceneDelegate, so it is what is actually visible on the in-car
// display. CPMapTemplate overlays the nav bar, panning controls, and
// navigation alerts on top.
//
// Bound to RoamCarPlaySharedState through CarPlayNavigationCoordinator,
// which calls render*/clear* on this VC when state changes.

import CarPlay
import CoreLocation
import MapKit
import UIKit

@available(iOS 14.0, *)
final class CarPlayMapViewController: UIViewController {

    private let mapView = MKMapView()
    private var routeOverlay: MKPolyline?
    private var driverAnnotation: MKPointAnnotation?
    private var hazardAnnotations: [MKPointAnnotation] = []
    private var fuelAnnotations: [MKPointAnnotation] = []

    private var followDriver = true

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        configureMapView()
        // Initial follow on first render if state already has a fix.
        followDriverLocation()
        // Render any pre-existing hazards / fuel from shared state.
        renderHazards(RoamCarPlaySharedState.shared.hazards)
        renderFuelStops(RoamCarPlaySharedState.shared.fuelStops)
    }

    private func configureMapView() {
        mapView.translatesAutoresizingMaskIntoConstraints = false
        mapView.mapType = .mutedStandard
        mapView.delegate = self
        mapView.pointOfInterestFilter = .excludingAll
        mapView.showsTraffic = false
        mapView.showsCompass = false
        mapView.showsScale = false
        view.addSubview(mapView)
        NSLayoutConstraint.activate([
            mapView.topAnchor.constraint(equalTo: view.topAnchor),
            mapView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            mapView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            mapView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
    }

    // MARK: - Route

    func renderRoute(polyline6: String) {
        let coords = CarPlayNavigationCoordinator.decodePolyline6(polyline6)
        guard coords.count >= 2 else { return }

        if let existing = routeOverlay {
            mapView.removeOverlay(existing)
        }
        let line = MKPolyline(coordinates: coords, count: coords.count)
        mapView.addOverlay(line, level: .aboveRoads)
        routeOverlay = line

        if !followDriver {
            let rect = line.boundingMapRect
            let edge = UIEdgeInsets(top: 60, left: 60, bottom: 60, right: 60)
            mapView.setVisibleMapRect(rect, edgePadding: edge, animated: true)
        }
    }

    func clearRoute() {
        if let existing = routeOverlay {
            mapView.removeOverlay(existing)
        }
        routeOverlay = nil
    }

    // MARK: - Hazards

    func renderHazards(_ hazards: [RoamCarPlaySharedState.Hazard]) {
        if !hazardAnnotations.isEmpty {
            mapView.removeAnnotations(hazardAnnotations)
            hazardAnnotations = []
        }
        for h in hazards {
            let pin = MKPointAnnotation()
            pin.coordinate = CLLocationCoordinate2D(latitude: h.lat, longitude: h.lng)
            pin.title = h.headline
            pin.subtitle = h.detail ?? h.typeLabel
            hazardAnnotations.append(pin)
        }
        mapView.addAnnotations(hazardAnnotations)
    }

    func clearHazardPins() {
        mapView.removeAnnotations(hazardAnnotations)
        hazardAnnotations = []
    }

    // MARK: - Fuel stops

    func renderFuelStops(_ stops: [RoamCarPlaySharedState.FuelStop]) {
        if !fuelAnnotations.isEmpty {
            mapView.removeAnnotations(fuelAnnotations)
            fuelAnnotations = []
        }
        for f in stops {
            let pin = MKPointAnnotation()
            pin.coordinate = CLLocationCoordinate2D(latitude: f.lat, longitude: f.lng)
            pin.title = f.brand ?? f.name
            pin.subtitle = f.isLastChance ? "Last fuel" : nil
            fuelAnnotations.append(pin)
        }
        mapView.addAnnotations(fuelAnnotations)
    }

    // MARK: - Driver follow

    func followDriverLocation() {
        guard let loc = RoamCarPlaySharedState.shared.driverLocation else { return }
        followDriver = true
        let coord = CLLocationCoordinate2D(latitude: loc.lat, longitude: loc.lng)

        if driverAnnotation == nil {
            let pin = MKPointAnnotation()
            pin.coordinate = coord
            pin.title = "You"
            mapView.addAnnotation(pin)
            driverAnnotation = pin
        } else {
            driverAnnotation?.coordinate = coord
        }

        let span = MKCoordinateSpan(latitudeDelta: 0.05, longitudeDelta: 0.05)
        let region = MKCoordinateRegion(center: coord, span: span)
        mapView.setRegion(region, animated: true)
    }

    func stopFollowingDriver() {
        followDriver = false
    }

    // MARK: - Panning

    func pan(direction: CPMapTemplate.PanDirection) {
        followDriver = false
        var dx = 0.0
        var dy = 0.0
        let step = mapView.region.span.longitudeDelta * 0.25
        if direction.contains(.left)  { dx = -step }
        if direction.contains(.right) { dx =  step }
        if direction.contains(.up)    { dy =  step }
        if direction.contains(.down)  { dy = -step }
        let centre = mapView.centerCoordinate
        let newCentre = CLLocationCoordinate2D(
            latitude:  centre.latitude  + dy,
            longitude: centre.longitude + dx
        )
        let region = MKCoordinateRegion(center: newCentre, span: mapView.region.span)
        mapView.setRegion(region, animated: true)
    }
}

// MARK: - MKMapViewDelegate

@available(iOS 14.0, *)
extension CarPlayMapViewController: MKMapViewDelegate {

    func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
        if let polyline = overlay as? MKPolyline {
            let renderer = MKPolylineRenderer(polyline: polyline)
            renderer.strokeColor = UIColor.systemBlue.withAlphaComponent(0.95)
            renderer.lineWidth = 7
            renderer.lineCap = .round
            renderer.lineJoin = .round
            return renderer
        }
        return MKOverlayRenderer(overlay: overlay)
    }

    func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
        guard let point = annotation as? MKPointAnnotation else { return nil }

        let id = "RoamCarPlayPin"
        let view = mapView.dequeueReusableAnnotationView(withIdentifier: id) as? MKMarkerAnnotationView
            ?? MKMarkerAnnotationView(annotation: point, reuseIdentifier: id)
        view.annotation = point
        view.canShowCallout = false

        if hazardAnnotations.contains(point) {
            view.markerTintColor = .systemOrange
            view.glyphImage = UIImage(systemName: "exclamationmark.triangle.fill")
        } else if fuelAnnotations.contains(point) {
            view.markerTintColor = .systemGreen
            view.glyphImage = UIImage(systemName: "fuelpump.fill")
        } else if point === driverAnnotation {
            view.markerTintColor = .systemBlue
            view.glyphImage = UIImage(systemName: "location.fill")
        } else {
            view.markerTintColor = .systemGray
        }
        return view
    }
}
