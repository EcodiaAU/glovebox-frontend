// CarPlayMapViewController.swift
//
// MKMapView host for the CarPlay scene. v1.1 uses Apple's MapKit because
// it is the only map renderer Apple ships with first-class CarPlay support
// out of the box. v1.2 may swap for MapLibre native if there is a strong
// reason (custom outback tile styling); for now the goal is to land the
// scaffold without that complexity.
//
// This view controller is NOT directly presented by CarPlay (CarPlay
// templates are not view controllers). It is hosted inside the phone app's
// scene to provide a render surface for route preview screenshots that
// get serialised into CPMapTemplate operations, and for testing in the
// simulator.
//
// Implementation pass binds it to CarPlayNavigationCoordinator state and
// adds overlay layers for hazards, fuel stops, fatigue prompts.

import MapKit
import UIKit

@available(iOS 14.0, *)
final class CarPlayMapViewController: UIViewController {

    private let mapView = MKMapView()
    private var routeOverlay: MKPolyline?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        configureMapView()
    }

    private func configureMapView() {
        mapView.translatesAutoresizingMaskIntoConstraints = false
        mapView.mapType = .standard
        mapView.delegate = self
        mapView.pointOfInterestFilter = .excludingAll
        view.addSubview(mapView)
        NSLayoutConstraint.activate([
            mapView.topAnchor.constraint(equalTo: view.topAnchor),
            mapView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            mapView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            mapView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
    }

    // Draw a route from a polyline6 string. Called by the coordinator
    // once a NavPackResponse arrives.
    func renderRoute(polyline6: String) {
        let coords = CarPlayNavigationCoordinator.decodePolyline6(polyline6)
        guard coords.count >= 2 else { return }

        if let existing = routeOverlay {
            mapView.removeOverlay(existing)
        }
        let line = MKPolyline(coordinates: coords, count: coords.count)
        mapView.addOverlay(line)
        routeOverlay = line

        // Fit camera to the route bounds with padding.
        let rect = line.boundingMapRect
        let edge = UIEdgeInsets(top: 80, left: 80, bottom: 80, right: 80)
        mapView.setVisibleMapRect(rect, edgePadding: edge, animated: false)
    }

    // Add a single hazard pin. Implementation pass adds clustering.
    func addHazardPin(coordinate: CLLocationCoordinate2D, title: String, subtitle: String?) {
        let pin = MKPointAnnotation()
        pin.coordinate = coordinate
        pin.title = title
        pin.subtitle = subtitle
        mapView.addAnnotation(pin)
    }

    func clearHazardPins() {
        mapView.removeAnnotations(mapView.annotations)
    }
}

@available(iOS 14.0, *)
extension CarPlayMapViewController: MKMapViewDelegate {

    func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
        if let polyline = overlay as? MKPolyline {
            let renderer = MKPolylineRenderer(polyline: polyline)
            renderer.strokeColor = UIColor.systemBlue.withAlphaComponent(0.9)
            renderer.lineWidth = 6
            return renderer
        }
        return MKOverlayRenderer(overlay: overlay)
    }
}
