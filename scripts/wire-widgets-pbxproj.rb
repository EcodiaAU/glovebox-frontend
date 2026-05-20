#!/usr/bin/env ruby
# scripts/wire-widgets-pbxproj.rb
#
# Idempotent wire-up of the Nav. widgets + Live Activity into
# ios/App/App.xcodeproj:
#
#   1. Adds the shared models (Shared/*.swift) to BOTH the App target and a
#      new NavWidgetsExtension target.
#   2. Adds NavWidgetsBridge.swift to the App target (Capacitor plugin).
#   3. Creates the NavWidgetsExtension app-extension target with its SwiftUI
#      sources, Info.plist, and App Group entitlements.
#   4. Adds the App Group to the App target (entitlements already updated on
#      disk; this just guarantees CODE_SIGN_ENTITLEMENTS is set).
#   5. Makes the App target depend on + embed the extension.
#
# Run on the Mac (SY094) AFTER `pod install`:
#
#   cd frontend
#   ruby scripts/wire-widgets-pbxproj.rb
#
# Safe to re-run: every step checks for existing entries and skips them.
# Requires the xcodeproj gem (bundled with cocoapods).

require "xcodeproj"

PROJECT_PATH = File.expand_path("../ios/App/App.xcodeproj", __dir__)
TEAM_ID = "86PUY7393S"
EXT_TARGET_NAME = "NavWidgetsExtension"
EXT_BUNDLE_ID = "au.ecodia.roam.widgets"
APP_GROUP = "group.au.ecodia.roam"
EXT_DEPLOYMENT_TARGET = "16.0"

SHARED_FILES = ["NavWidgetModels.swift", "AppGroupStore.swift"]   # both targets
APP_ONLY_FILES = ["NavWidgetsBridge.swift"]                       # App target only
EXT_FILES = [                                                     # extension only
  "NavTheme.swift", "NavTimeline.swift", "NavLiveActivity.swift",
  "NavHomeWidgets.swift", "NavAccessoryWidgets.swift",
  "NavAppIntents.swift", "NavStartControl.swift", "NavWidgetsBundle.swift",
]

abort "Project not found at #{PROJECT_PATH}" unless File.exist?(PROJECT_PATH)
project = Xcodeproj::Project.open(PROJECT_PATH)
app_target = project.targets.find { |t| t.name == "App" }
abort "App target not found" unless app_target

def find_or_create_group(project, name, path)
  grp = project.main_group.children.find { |c| c.respond_to?(:display_name) && c.display_name == name }
  grp ||= project.main_group.new_group(name, path)
  grp
end

def file_ref_in(group, name)
  group.files.find { |f| f.path == name }
end

def add_ref(group, name)
  file_ref_in(group, name) || group.new_reference(name)
end

def ensure_source(target, ref)
  return if target.source_build_phase.files_references.include?(ref)
  target.add_file_references([ref])
end

# ─── Groups ──────────────────────────────────────────────────────────────────
app_group   = project.main_group.children.find { |c| c.respond_to?(:display_name) && c.display_name == "App" }
abort "App group not found" unless app_group
shared_group = find_or_create_group(project, "Shared", "Shared")
ext_group    = find_or_create_group(project, "NavWidgets", "NavWidgets")

# ─── Extension target (create if missing) ────────────────────────────────────
ext_target = project.targets.find { |t| t.name == EXT_TARGET_NAME }
if ext_target.nil?
  ext_target = project.new_target(
    :app_extension, EXT_TARGET_NAME, :ios, EXT_DEPLOYMENT_TARGET, project.products_group, :swift
  )
  puts "[add ] target #{EXT_TARGET_NAME}"
else
  puts "[skip] target #{EXT_TARGET_NAME} already exists"
end

# ─── Build settings on the extension (all configs, incl Release-CarPlay) ─────
ext_target.build_configurations.each do |conf|
  bs = conf.build_settings
  bs["PRODUCT_BUNDLE_IDENTIFIER"] = EXT_BUNDLE_ID
  bs["PRODUCT_NAME"] = "$(TARGET_NAME)"
  bs["INFOPLIST_FILE"] = "NavWidgets/Info.plist"
  bs["CODE_SIGN_ENTITLEMENTS"] = "NavWidgets/NavWidgets.entitlements"
  bs["CODE_SIGN_STYLE"] = "Automatic"
  bs["DEVELOPMENT_TEAM"] = TEAM_ID
  bs["IPHONEOS_DEPLOYMENT_TARGET"] = EXT_DEPLOYMENT_TARGET
  bs["TARGETED_DEVICE_FAMILY"] = "1,2"
  bs["SWIFT_VERSION"] = "5.0"
  bs["SKIP_INSTALL"] = "YES"
  bs["GENERATE_INFOPLIST_FILE"] = "NO"
  bs["MARKETING_VERSION"] = "$(MARKETING_VERSION)"
  bs["CURRENT_PROJECT_VERSION"] = "$(CURRENT_PROJECT_VERSION)"
  bs["LD_RUNPATH_SEARCH_PATHS"] = ["$(inherited)", "@executable_path/Frameworks", "@executable_path/../../Frameworks"]
  bs["SWIFT_EMIT_LOC_STRINGS"] = "YES"
  bs["ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME"] = ""
end
puts "[set ] extension build settings (#{ext_target.build_configurations.size} configs)"

# ─── File references + source membership ─────────────────────────────────────
SHARED_FILES.each do |name|
  ref = add_ref(shared_group, name)
  ensure_source(app_target, ref)
  ensure_source(ext_target, ref)
  puts "[wire] #{name} -> App + #{EXT_TARGET_NAME}"
end

APP_ONLY_FILES.each do |name|
  ref = add_ref(app_group, name)
  ensure_source(app_target, ref)
  puts "[wire] #{name} -> App"
end

EXT_FILES.each do |name|
  ref = add_ref(ext_group, name)
  ensure_source(ext_target, ref)
  puts "[wire] #{name} -> #{EXT_TARGET_NAME}"
end

# Info.plist + entitlements as project members (not compiled)
["Info.plist", "NavWidgets.entitlements"].each do |name|
  unless file_ref_in(ext_group, name)
    r = ext_group.new_reference(name)
    r.last_known_file_type = "text.plist.entitlements" if name.end_with?(".entitlements")
    puts "[add ] NavWidgets/#{name} (member, not compiled)"
  end
end

# ─── App depends on + embeds the extension ───────────────────────────────────
unless app_target.dependencies.any? { |d| d.target == ext_target }
  app_target.add_dependency(ext_target)
  puts "[add ] App depends on #{EXT_TARGET_NAME}"
end

embed_phase = app_target.copy_files_build_phases.find { |p| p.symbol_dst_subfolder_spec == :plug_ins }
if embed_phase.nil?
  embed_phase = app_target.new_copy_files_build_phase("Embed App Extensions")
  embed_phase.symbol_dst_subfolder_spec = :plug_ins
  puts "[add ] Embed App Extensions copy phase"
end
ext_product = ext_target.product_reference
unless embed_phase.files_references.include?(ext_product)
  build_file = embed_phase.add_file_reference(ext_product)
  build_file.settings = { "ATTRIBUTES" => ["RemoveHeadersOnCopy"] }
  puts "[add ] embed #{EXT_TARGET_NAME}.appex"
end

# ─── Guarantee App target has its entitlements wired (App Group) ─────────────
app_target.build_configurations.each do |conf|
  cur = conf.build_settings["CODE_SIGN_ENTITLEMENTS"]
  if cur.nil? || cur.empty?
    # Release-CarPlay uses App-CarPlay.entitlements; everything else App.entitlements.
    conf.build_settings["CODE_SIGN_ENTITLEMENTS"] =
      conf.name == "Release-CarPlay" ? "App/App-CarPlay.entitlements" : "App/App.entitlements"
    puts "[set ] App/#{conf.name} CODE_SIGN_ENTITLEMENTS -> #{conf.build_settings["CODE_SIGN_ENTITLEMENTS"]}"
  end
end

project.save
puts "[save] #{PROJECT_PATH}"
puts
puts "OK. Open ios/App/App.xcworkspace and verify:"
puts "  - #{EXT_TARGET_NAME} target exists (bundle id #{EXT_BUNDLE_ID})"
puts "  - App target embeds #{EXT_TARGET_NAME}.appex"
puts "  - Both App + #{EXT_TARGET_NAME} have App Group #{APP_GROUP}"
puts "  - Build the 'App' scheme; the widgets + Live Activity compile into the .appex"
