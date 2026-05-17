// CarPlaySceneDelegate.swift
//
// Entry point for the CarPlay scene. iOS instantiates this class when the
// CarPlay-equipped vehicle connects, based on the UIApplicationSceneManifest
// entry in Info.plist that maps CPTemplateApplicationSceneSessionRoleApplication
// to this class.
//
// Scaffold for v1.1. Implementation pass lands the full template tree.
// Tested in Xcode's CarPlay simulator without the carplay-maps entitlement.

import CarPlay
import UIKit

@available(iOS 14.0, *)
class CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {

    var interfaceController: CPInterfaceController?

    // Called when CarPlay attaches. Build the root template and present it.
    func templateApplicationScene(
        _ templateApplicationScene: CPTemplateApplicationScene,
        didConnect interfaceController: CPInterfaceController
    ) {
        self.interfaceController = interfaceController

        // Coordinator wakes up. Backend nav calls share the same endpoints
        // the phone app uses (see CarPlayNavigationCoordinator).
        CarPlayNavigationCoordinator.shared.sceneDidConnect()

        let rootTemplate = makeRootMapTemplate()
        interfaceController.setRootTemplate(rootTemplate, animated: false, completion: nil)
    }

    // Called when CarPlay detaches (vehicle disconnects, user undocks phone).
    func templateApplicationScene(
        _ templateApplicationScene: CPTemplateApplicationScene,
        didDisconnectInterfaceController interfaceController: CPInterfaceController
    ) {
        CarPlayNavigationCoordinator.shared.sceneDidDisconnect()
        self.interfaceController = nil
    }

    // Root: the map template with leading + trailing nav-bar buttons.
    // The buttons are stubs in v1.1 scaffold; implementation pass wires them.
    private func makeRootMapTemplate() -> CPMapTemplate {
        let mapTemplate = CPMapTemplate()

        let searchButton = CPBarButton(image: UIImage(systemName: "magnifyingglass") ?? UIImage()) { [weak self] _ in
            self?.presentSearchTemplate()
        }
        let plansButton = CPBarButton(image: UIImage(systemName: "list.bullet") ?? UIImage()) { [weak self] _ in
            self?.presentPlansListTemplate()
        }

        mapTemplate.leadingNavigationBarButtons = [searchButton]
        mapTemplate.trailingNavigationBarButtons = [plansButton]
        mapTemplate.mapDelegate = CarPlayNavigationCoordinator.shared

        return mapTemplate
    }

    // CPSearchTemplate stub. Will wire to CarPlayNavigationCoordinator.searchPOI.
    private func presentSearchTemplate() {
        let search = CPSearchTemplate()
        search.delegate = CarPlayNavigationCoordinator.shared
        interfaceController?.pushTemplate(search, animated: true, completion: nil)
    }

    // CPListTemplate stub. Will populate from saved plans + alternates.
    private func presentPlansListTemplate() {
        let header = CPListSection(items: [
            CPListItem(text: "Loading saved plans...", detailText: nil)
        ])
        let list = CPListTemplate(title: "Plans", sections: [header])
        interfaceController?.pushTemplate(list, animated: true, completion: nil)
    }
}
