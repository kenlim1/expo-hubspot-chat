/** @typedef {import('@expo/config-plugins').ConfigPlugin} ConfigPlugin */
/** @typedef {import('@expo/config-plugins').ExportedConfig} ExportedConfig */

/**
 * @typedef {Object} HubspotChatPluginProps
 * @property {string} portalId - HubSpot portal ID (required)
 * @property {string} hublet - HubSpot hublet region identifier, e.g. "na1", "eu1" (required)
 * @property {'production' | 'qa'} [environment] - HubSpot environment. Defaults to "production".
 * @property {string} [defaultChatFlow] - Default chat flow identifier
 */

const {
  withDangerousMod,
  withAndroidManifest,
  withAppBuildGradle,
  withXcodeProject,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// --- Android ---

/**
 * @param {ExportedConfig} config
 * @param {HubspotChatPluginProps} props
 */
function withHubspotAndroid(config, props) {
  config = withHubspotAndroidAssets(config, props);
  config = withHubspotAndroidManifest(config);
  config = withHubspotAndroidStyles(config);
  config = withHubspotAndroidPackaging(config);
  return config;
}

/**
 * @param {ExportedConfig} config
 * @param {HubspotChatPluginProps} props
 */
function withHubspotAndroidAssets(config, props) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const assetsDir = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'assets',
      );

      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
      }

      const hubspotConfig = {
        portalId: props.portalId,
        hublet: props.hublet,
        environment: props.environment || 'production',
        ...(props.defaultChatFlow && {
          defaultChatFlow: props.defaultChatFlow,
        }),
      };

      fs.writeFileSync(
        path.join(assetsDir, 'hubspot-info.json'),
        JSON.stringify(hubspotConfig, null, 2),
      );

      return config;
    },
  ]);
}

/** @param {ExportedConfig} config */
function withHubspotAndroidManifest(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    if (!manifest.$) {
      manifest.$ = {};
    }
    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    const mainApplication = manifest.application?.[0];

    if (!mainApplication) return config;

    if (!mainApplication.activity) {
      mainApplication.activity = [];
    }

    const hubspotActivityExists = mainApplication.activity.some(
      (activity) =>
        activity.$?.['android:name'] ===
        'com.hubspot.mobilesdk.HubspotWebActivity',
    );

    if (!hubspotActivityExists) {
      mainApplication.activity.push({
        $: {
          'android:name': 'com.hubspot.mobilesdk.HubspotWebActivity',
          'android:theme': '@style/Theme.HubspotTheme',
          'android:exported': 'false',
          'tools:replace': 'android:exported,android:theme',
        },
      });
    }

    if (!mainApplication.service) {
      mainApplication.service = [];
    }

    const messagingServiceExists = mainApplication.service.some(
      (service) =>
        service.$?.['android:name'] ===
        'expo.modules.hubspotchat.HubspotChatMessagingService',
    );

    if (!messagingServiceExists) {
      mainApplication.service.push({
        $: {
          'android:name':
            'expo.modules.hubspotchat.HubspotChatMessagingService',
          'android:exported': 'false',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'com.google.firebase.MESSAGING_EVENT',
                },
              },
            ],
          },
        ],
      });
    }

    return config;
  });
}

/**
 * Patches values/styles.xml and values-night/styles.xml to add a custom theme
 * for HubspotWebActivity that controls status bar icon appearance.
 *
 * - Light mode (values/styles.xml): windowLightStatusBar = true (dark icons)
 * - Dark mode (values-night/styles.xml): windowLightStatusBar = false (light icons)
 *
 * @param {ExportedConfig} config
 */
function withHubspotAndroidStyles(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const resDir = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
      );

      const styleName = 'Theme.HubspotTheme';
      const parentTheme = 'Theme.AppCompat.DayNight.NoActionBar';

      const configs = [
        {
          dir: path.join(resDir, 'values'),
          windowLightStatusBar: 'true',
        },
        {
          dir: path.join(resDir, 'values-night'),
          windowLightStatusBar: 'false',
        },
      ];

      const styleBlock = (lightStatusBar) =>
        `    <style name="${styleName}" parent="${parentTheme}">\n` +
        `        <item name="android:windowLightStatusBar">${lightStatusBar}</item>\n` +
        `    </style>`;

      for (const { dir, windowLightStatusBar } of configs) {
        const stylesPath = path.join(dir, 'styles.xml');

        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        if (fs.existsSync(stylesPath)) {
          let contents = fs.readFileSync(stylesPath, 'utf-8');

          // Skip if the style already exists
          if (contents.includes(`name="${styleName}"`)) {
            continue;
          }

          // Insert before closing </resources> tag
          contents = contents.replace(
            '</resources>',
            `${styleBlock(windowLightStatusBar)}\n</resources>`,
          );

          fs.writeFileSync(stylesPath, contents);
        } else {
          // Create a new styles.xml with the theme
          const newStyles =
            '<?xml version="1.0" encoding="utf-8"?>\n' +
            '<resources>\n' +
            `${styleBlock(windowLightStatusBar)}\n` +
            '</resources>\n';

          fs.writeFileSync(stylesPath, newStyles);
        }
      }

      return config;
    },
  ]);
}

/** @param {ExportedConfig} config */
function withHubspotAndroidPackaging(config) {
  return withAppBuildGradle(config, (config) => {
    const packaging = `
    packaging {
        resources {
            excludes += [
                'META-INF/versions/9/OSGI-INF/MANIFEST.MF',
                'META-INF/DEPENDENCIES',
                'META-INF/LICENSE',
                'META-INF/LICENSE.txt',
                'META-INF/license.txt',
                'META-INF/NOTICE',
                'META-INF/NOTICE.txt',
                'META-INF/notice.txt',
                'META-INF/ASL2.0',
                'META-INF/*.kotlin_module'
            ]
        }
    }`;

    if (
      config.modResults.contents.includes(
        "excludes += ['META-INF/versions/9/OSGI-INF/MANIFEST.MF'",
      )
    ) {
      return config;
    }

    config.modResults.contents = config.modResults.contents.replace(
      /android\s*\{/,
      `android {${packaging}`,
    );

    return config;
  });
}

// --- iOS ---

/**
 * @param {ExportedConfig} config
 * @param {HubspotChatPluginProps} props
 */
function withHubspotIos(config, props) {
  config = withHubspotIosPlist(config, props);
  config = withHubspotIosPlistResource(config);
  return config;
}

/**
 * @param {ExportedConfig} config
 * @param {HubspotChatPluginProps} props
 */
function withHubspotIosPlist(config, props) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const iosDir = config.modRequest.platformProjectRoot;

      const defaultChatFlowEntry = props.defaultChatFlow
        ? `\n  <key>defaultChatFlow</key>\n  <string>${props.defaultChatFlow}</string>`
        : '';

      const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>portalId</key>
  <string>${props.portalId}</string>
  <key>hublet</key>
  <string>${props.hublet}</string>
  <key>environment</key>
  <string>${props.environment || 'production'}</string>${defaultChatFlowEntry}
</dict>
</plist>`;

      const appName = config.modRequest.projectName || config.name;
      fs.writeFileSync(path.join(iosDir, appName, 'Hubspot-Info.plist'), plistContent);

      return config;
    },
  ]);
}

/** @param {ExportedConfig} config */
function withHubspotIosPlistResource(config) {
  return withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;
    const appName = config.modRequest.projectName || config.name;
    const plistPath = 'Hubspot-Info.plist';

    // Check if already added to the project
    const hasFile = Object.values(xcodeProject.pbxFileReferenceSection()).some(
      (ref) => ref && ref.path === `${appName}/${plistPath}`,
    );

    if (!hasFile) {
      // Manually add file reference, build file, and resource build phase entry.
      // addResourceFile fails when the Xcode project has no "Resources" group,
      // which is typical for Expo-managed projects.
      const fileRefUuid = xcodeProject.generateUuid();
      const buildFileUuid = xcodeProject.generateUuid();
      const target = xcodeProject.getFirstTarget().uuid;

      xcodeProject.pbxFileReferenceSection()[fileRefUuid] = {
        isa: 'PBXFileReference',
        lastKnownFileType: 'text.plist.xml',
        name: plistPath,
        path: `${appName}/${plistPath}`,
        sourceTree: '"<group>"',
      };
      xcodeProject.pbxFileReferenceSection()[`${fileRefUuid}_comment`] =
        plistPath;

      xcodeProject.pbxBuildFileSection()[buildFileUuid] = {
        isa: 'PBXBuildFile',
        fileRef: fileRefUuid,
        fileRef_comment: plistPath,
      };
      xcodeProject.pbxBuildFileSection()[`${buildFileUuid}_comment`] =
        `${plistPath} in Resources`;

      const resourcesBuildPhase =
        xcodeProject.pbxResourcesBuildPhaseObj(target);
      if (resourcesBuildPhase) {
        resourcesBuildPhase.files.push({
          value: buildFileUuid,
          comment: `${plistPath} in Resources`,
        });
      }

      const mainGroupId =
        xcodeProject.pbxProjectSection()[xcodeProject.getFirstProject().uuid]
          .mainGroup;
      const mainGroup =
        xcodeProject.pbxGroupByName(appName) ||
        xcodeProject.getPBXGroupByKey(mainGroupId);
      if (mainGroup && mainGroup.children) {
        mainGroup.children.push({
          value: fileRefUuid,
          comment: plistPath,
        });
      }
    }

    return config;
  });
}

// --- Main Plugin ---

/** @type {ConfigPlugin<HubspotChatPluginProps>} */
const withHubspotChat = (config, props = {}) => {
  if (!props.portalId) {
    throw new Error(
      '[expo-hubspot-chat] "portalId" is required in plugin configuration.',
    );
  }

  if (!props.hublet) {
    throw new Error(
      '[expo-hubspot-chat] "hublet" is required in plugin configuration.',
    );
  }

  if (
    props.environment &&
    props.environment !== 'prod' &&
    props.environment !== 'qa'
  ) {
    console.warn(
      `[expo-hubspot-chat] Invalid environment "${props.environment}". Expected "prod" or "qa". Defaulting to "prod".`,
    );
  }

  config = withHubspotAndroid(config, props);
  config = withHubspotIos(config, props);

  return config;
};

module.exports = withHubspotChat;
