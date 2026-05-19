#!/usr/bin/env ruby
# scripts/wire-carplay-pbxproj.rb
#
# Idempotent wire-up of the CarPlay scaffold into ios/App/App.xcodeproj:
#
#   1. Adds five Swift sources + one entitlements file to the App target.
#   2. Adds a Release-CarPlay build configuration that uses
#      App/App-CarPlay.entitlements as CODE_SIGN_ENTITLEMENTS (so the
#      restricted com.apple.developer.carplay-maps entitlement only
#      applies to that config, not to the regular Release ship).
#   3. Adds an "App-CarPlay" scheme that builds with Release-CarPlay.
#
# Run on the Mac (SY094) AFTER `pod install`:
#
#   cd frontend
#   ruby scripts/wire-carplay-pbxproj.rb
#
# Safe to re-run: each step checks for existing entries and skips them.
#
# Requires the xcodeproj gem (bundled with cocoapods). If missing:
#   sudo gem install xcodeproj

require "xcodeproj"
require "fileutils"

PROJECT_PATH = File.expand_path("../ios/App/App.xcodeproj", __dir__)
APP_GROUP_PATH = "App"  # group inside the project (mirrors disk path ios/App/App/)

SWIFT_FILES = [
  "RoamCarPlaySharedState.swift",
  "RoamCarPlayBridge.swift",
  "CarPlaySceneDelegate.swift",
  "CarPlayNavigationCoordinator.swift",
  "CarPlayMapViewController.swift",
]

ENTITLEMENTS_FILE = "App-CarPlay.entitlements"

NEW_CONFIG_NAME = "Release-CarPlay"
BASE_CONFIG_NAME = "Release"

NEW_SCHEME_NAME = "App-CarPlay"
BASE_SCHEME_NAME = "App"

CARPLAY_ENTITLEMENTS_PATH = "App/App-CarPlay.entitlements"

unless File.exist?(PROJECT_PATH)
  abort "Project not found at #{PROJECT_PATH}"
end

project = Xcodeproj::Project.open(PROJECT_PATH)
app_target = project.targets.find { |t| t.name == "App" }
abort "App target not found in #{PROJECT_PATH}" unless app_target

# ─── 1. Files ───────────────────────────────────────────────────────────────

app_group = project.main_group.find_subpath(APP_GROUP_PATH, false)
abort "Group '#{APP_GROUP_PATH}' not found in project" unless app_group

def has_file?(group, name)
  group.children.any? { |c| c.respond_to?(:path) && c.path == name }
end

added_swift = 0
SWIFT_FILES.each do |name|
  if has_file?(app_group, name)
    puts "[skip] #{name} already in project"
    next
  end
  ref = app_group.new_reference(name)
  app_target.add_file_references([ref])
  added_swift += 1
  puts "[add ] #{name} (compiled into App target)"
end

if has_file?(app_group, ENTITLEMENTS_FILE)
  puts "[skip] #{ENTITLEMENTS_FILE} already in project"
else
  ref = app_group.new_reference(ENTITLEMENTS_FILE)
  ref.last_known_file_type = "text.plist.entitlements"
  # Not a source file - do not add to compile phase.
  puts "[add ] #{ENTITLEMENTS_FILE} (project member, not compiled)"
end

# ─── 2. Build configuration ─────────────────────────────────────────────────

def add_configuration(project, name, base_name)
  # Project-level
  unless project.build_configurations.any? { |c| c.name == name }
    base = project.build_configurations.find { |c| c.name == base_name }
    raise "Project has no '#{base_name}' configuration" unless base
    new_conf = project.new(Xcodeproj::Project::Object::XCBuildConfiguration)
    new_conf.name = name
    new_conf.build_settings = deep_copy_settings(base.build_settings)
    project.build_configuration_list.build_configurations << new_conf
    puts "[add ] project-level '#{name}' configuration (copied from '#{base_name}')"
  else
    puts "[skip] project-level '#{name}' configuration already exists"
  end

  # Target-level (each target)
  project.targets.each do |t|
    unless t.build_configurations.any? { |c| c.name == name }
      base = t.build_configurations.find { |c| c.name == base_name }
      next unless base
      new_conf = project.new(Xcodeproj::Project::Object::XCBuildConfiguration)
      new_conf.name = name
      new_conf.build_settings = deep_copy_settings(base.build_settings)
      t.build_configuration_list.build_configurations << new_conf
      puts "[add ] target '#{t.name}' '#{name}' configuration"
    end
  end
end

def deep_copy_settings(settings)
  Marshal.load(Marshal.dump(settings))
end

add_configuration(project, NEW_CONFIG_NAME, BASE_CONFIG_NAME)

# Apply the CarPlay entitlements only to the App target's new config.
app_carplay_conf = app_target.build_configurations.find { |c| c.name == NEW_CONFIG_NAME }
if app_carplay_conf
  current = app_carplay_conf.build_settings["CODE_SIGN_ENTITLEMENTS"]
  if current == CARPLAY_ENTITLEMENTS_PATH
    puts "[skip] CODE_SIGN_ENTITLEMENTS on App/#{NEW_CONFIG_NAME} already #{CARPLAY_ENTITLEMENTS_PATH}"
  else
    app_carplay_conf.build_settings["CODE_SIGN_ENTITLEMENTS"] = CARPLAY_ENTITLEMENTS_PATH
    puts "[set ] CODE_SIGN_ENTITLEMENTS on App/#{NEW_CONFIG_NAME} -> #{CARPLAY_ENTITLEMENTS_PATH}"
  end
end

# ─── 3. Save project ────────────────────────────────────────────────────────

project.save
puts "[save] #{PROJECT_PATH}"

# ─── 4. Scheme (best-effort - shared scheme on disk) ────────────────────────

shared_dir = File.join(PROJECT_PATH, "xcshareddata", "xcschemes")
FileUtils.mkdir_p(shared_dir)

base_scheme_path = File.join(shared_dir, "#{BASE_SCHEME_NAME}.xcscheme")
new_scheme_path  = File.join(shared_dir, "#{NEW_SCHEME_NAME}.xcscheme")

if File.exist?(new_scheme_path)
  puts "[skip] scheme #{NEW_SCHEME_NAME} already exists"
elsif File.exist?(base_scheme_path)
  body = File.read(base_scheme_path)
  body = body.gsub(/buildConfiguration\s*=\s*"Release"/, %(buildConfiguration="#{NEW_CONFIG_NAME}"))
  File.write(new_scheme_path, body)
  puts "[add ] scheme #{NEW_SCHEME_NAME} -> Release replaced with #{NEW_CONFIG_NAME}"
else
  puts "[warn] base scheme #{BASE_SCHEME_NAME} not found at #{base_scheme_path}; create scheme in Xcode IDE manually"
end

puts
puts "OK. Open ios/App/App.xcworkspace and verify:"
puts "  - App target has #{SWIFT_FILES.size} new Swift files compiled"
puts "  - App target has 3 build configs (Debug, Release, Release-CarPlay)"
puts "  - Release-CarPlay's CODE_SIGN_ENTITLEMENTS = #{CARPLAY_ENTITLEMENTS_PATH}"
puts "  - Schemes dropdown shows '#{NEW_SCHEME_NAME}' (alongside App)"
