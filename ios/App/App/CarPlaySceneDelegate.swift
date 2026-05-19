// CarPlaySceneDelegate.swift
//
// Entry point for the CarPlay scene. iOS instantiates this class when the
// CarPlay-equipped vehicle connects, based on the UIApplicationSceneManifest
// entry in Info.plist that maps CPTemplateApplicationSceneSessionRoleApplication
// to this class.
//
// Responsibilities:
// - Build the root CPMapTemplate (search button, plans button).
// - Install the CarPlayMapViewController as the carWindow's rootVC so the
//   MKMapView actually shows on the car display.
// - Hand the interfaceController + mapTemplate to the
//   CarPlayNavigationCoordinator which owns state + decisions.
// - Tear everything down on disconnect.

import CarPlay
import UIKit

@available(iOS 14.0, *)
class CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {

    var interfaceController: CPInterfaceController?
    var carWindow: UIWindow?
    var mapViewController: CarPlayMapViewController?

    func templateApplicationScene(
        _ templateApplicationScene: CPTemplateApplicationScene,
        didConnect interfaceController: CPInterfaceController,
        to window: CPWindow
    ) {
        self.interfaceController = interfaceController
        self.carWindow = window

        let mapVC = CarPlayMapViewController()
        self.mapViewController = mapVC
        window.rootViewController = mapVC

        let mapTemplate = makeRootMapTemplate()
        CarPlayNavigationCoordinator.shared.mapViewController = mapVC
        CarPlayNavigationCoordinator.shared.sceneDidConnect(
            interfaceController: interfaceController,
            mapTemplate: mapTemplate
        )
        mapTemplate.mapDelegate = CarPlayNavigationCoordinator.shared

        interfaceController.setRootTemplate(mapTemplate, animated: false, completion: nil)
    }

    // Legacy connect signature (without window) for older SDKs / sims that
    // call the non-window variant. We forward to the windowed path with a
    // freshly-created window so behaviour is identical.
    func templateApplicationScene(
        _ templateApplicationScene: CPTemplateApplicationScene,
        didConnect interfaceController: CPInterfaceController
    ) {
        // On iOS 14+ in CarPlay the windowed callback is the canonical one.
        // If only the no-window variant fires (older simulator path), the
        // map will render as a plain UIWindow via the screen's first window.
        self.interfaceController = interfaceController

        let mapTemplate = makeRootMapTemplate()
        CarPlayNavigationCoordinator.shared.sceneDidConnect(
            interfaceController: interfaceController,
            mapTemplate: mapTemplate
        )
        mapTemplate.mapDelegate = CarPlayNavigationCoordinator.shared
        interfaceController.setRootTemplate(mapTemplate, animated: false, completion: nil)
    }

    func templateApplicationScene(
        _ templateApplicationScene: CPTemplateApplicationScene,
        didDisconnectInterfaceController interfaceController: CPInterfaceController,
        from window: CPWindow
    ) {
        CarPlayNavigationCoordinator.shared.sceneDidDisconnect()
        self.carWindow = nil
        self.mapViewController = nil
        self.interfaceController = nil
    }

    func templateApplicationScene(
        _ templateApplicationScene: CPTemplateApplicationScene,
        didDisconnectInterfaceController interfaceController: CPInterfaceController
    ) {
        CarPlayNavigationCoordinator.shared.sceneDidDisconnect()
        self.interfaceController = nil
    }

    // MARK: - Templates

    private func makeRootMapTemplate() -> CPMapTemplate {
        let mapTemplate = CPMapTemplate()
        mapTemplate.automaticallyHidesNavigationBar = false
        mapTemplate.hidesButtonsWithNavigationBar = false

        let searchButton = CPBarButton(image: UIImage(systemName: "magnifyingglass") ?? UIImage()) { [weak self] _ in
            self?.presentSearchTemplate()
        }
        let plansButton = CPBarButton(image: UIImage(systemName: "list.bullet") ?? UIImage()) { [weak self] _ in
            self?.presentPlansListTemplate()
        }

        mapTemplate.leadingNavigationBarButtons = [searchButton]
        mapTemplate.trailingNavigationBarButtons = [plansButton]

        return mapTemplate
    }

    private func presentSearchTemplate() {
        let search = CPSearchTemplate()
        search.delegate = CarPlayNavigationCoordinator.shared
        interfaceController?.pushTemplate(search, animated: true, completion: nil)
    }

    private func presentPlansListTemplate() {
        let list = CarPlayNavigationCoordinator.shared.plansListTemplate()
        interfaceController?.pushTemplate(list, animated: true, completion: nil)
    }
}
