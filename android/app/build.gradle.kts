import java.util.Properties
import java.io.FileInputStream
import java.net.URI

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.dagger.hilt.android")
    id("com.google.devtools.ksp")
}

val localProperties = Properties()
val localPropertiesFile = rootProject.file("local.properties")
if (localPropertiesFile.exists()) {
    localProperties.load(FileInputStream(localPropertiesFile))
}

android {
    namespace = "com.digitalsignage.player"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.digitalsignage.player"
        minSdk = 24
        targetSdk = 34
        versionCode = 3
        versionName = "1.0.0"
    }

    flavorDimensions += "environment"
    productFlavors {
        create("dev") {
            dimension = "environment"
            applicationIdSuffix = ".dev"
            versionNameSuffix = "-dev"
            
            val devUrl = localProperties.getProperty("DEV_API_URL") ?: System.getenv("DEV_API_URL")
            val devHost = localProperties.getProperty("DEV_API_HOST") ?: System.getenv("DEV_API_HOST")
            val devPort = localProperties.getProperty("DEV_API_PORT") ?: System.getenv("DEV_API_PORT")
            
            val finalBaseUrl: String
            val cleartextDomain: String?
            
            if (!devUrl.isNullOrEmpty()) {
                finalBaseUrl = if (devUrl.endsWith("/")) devUrl else "$devUrl/"
                val uri = URI(finalBaseUrl)
                cleartextDomain = if (uri.scheme.equals("http", ignoreCase = true)) uri.host else null
            } else if (!devHost.isNullOrEmpty() && !devPort.isNullOrEmpty()) {
                finalBaseUrl = "http://${devHost}:${devPort}/"
                cleartextDomain = devHost
            } else {
                throw GradleException("Either DEV_API_URL (e.g. DEV_API_URL=https://my-api.com/) or both DEV_API_HOST and DEV_API_PORT (e.g. DEV_API_HOST=192.168.1.100 DEV_API_PORT=8000) must be defined in local.properties or as environment variables for the 'dev' flavor.")
            }
            
            // Dynamically generate the dev flavor network_security_config.xml
            val resDir = file("src/dev/res/xml")
            if (!resDir.exists()) {
                resDir.mkdirs()
            }
            val xmlFile = file("src/dev/res/xml/network_security_config.xml")
            val cleartextDomainBlock = if (!cleartextDomain.isNullOrEmpty()) {
                """
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false">$cleartextDomain</domain>
    </domain-config>"""
            } else ""
            
            xmlFile.writeText("""<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>$cleartextDomainBlock
</network-security-config>
            """.trimIndent())
            
            buildConfigField("String", "BASE_URL", "\"$finalBaseUrl\"")
            buildConfigField("String", "ENVIRONMENT", "\"development\"")
        }
        create("staging") {
            dimension = "environment"
            applicationIdSuffix = ".staging"
            versionNameSuffix = "-staging"
            val stagingHost = localProperties.getProperty("STAGING_API_HOST") ?: System.getenv("STAGING_API_HOST") ?: "staging-api.digitalsignage.com"
            val stagingPort = localProperties.getProperty("STAGING_API_PORT") ?: System.getenv("STAGING_API_PORT")
            
            val url = if (stagingPort.isNullOrEmpty() || stagingPort == "443") {
                "https://${stagingHost}/"
            } else {
                "https://${stagingHost}:${stagingPort}/"
            }
            buildConfigField("String", "BASE_URL", "\"$url\"")
            buildConfigField("String", "ENVIRONMENT", "\"staging\"")
        }
        create("prod") {
            dimension = "environment"
            val prodHost = localProperties.getProperty("PROD_API_HOST") ?: System.getenv("PROD_API_HOST") ?: "digital-content-management-production-6fd4.up.railway.app"
            val prodPort = localProperties.getProperty("PROD_API_PORT") ?: System.getenv("PROD_API_PORT")
            
            val url = if (prodPort.isNullOrEmpty() || prodPort == "443") {
                "https://${prodHost}/"
            } else {
                "https://${prodHost}:${prodPort}/"
            }
            buildConfigField("String", "BASE_URL", "\"$url\"")
            buildConfigField("String", "ENVIRONMENT", "\"production\"")
        }
    }

    signingConfigs {
        create("release") {
            val keystoreFile = localProperties.getProperty("RELEASE_STORE_FILE") ?: System.getenv("RELEASE_STORE_FILE")
            val keystorePassword = localProperties.getProperty("RELEASE_STORE_PASSWORD") ?: System.getenv("RELEASE_STORE_PASSWORD")
            val keyAliasName = localProperties.getProperty("RELEASE_KEY_ALIAS") ?: System.getenv("RELEASE_KEY_ALIAS")
            val keyPasswordValue = localProperties.getProperty("RELEASE_KEY_PASSWORD") ?: System.getenv("RELEASE_KEY_PASSWORD")

            if (keystoreFile != null && keystorePassword != null && keyAliasName != null && keyPasswordValue != null) {
                storeFile = file(keystoreFile)
                storePassword = keystorePassword
                keyAlias = keyAliasName
                keyPassword = keyPasswordValue
            } else {
                // Fails the build during packaging if not properly configured
                storeFile = file("unconfigured_keystore")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            isDebuggable = false
            signingConfig = signingConfigs.getByName("release")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
    kotlinOptions {
        jvmTarget = "1.8"
    }
    buildFeatures {
        viewBinding = true
        buildConfig = true
    }
    testOptions {
        unitTests.isReturnDefaultValues = true
    }
    packaging {
        if (project.hasProperty("disableBaselineProfile") && project.property("disableBaselineProfile") == "true") {
            resources {
                excludes += "assets/dexopt/baseline-prof.txt"
                excludes += "assets/dexopt/baseline-prof.prof"
            }
        }
    }
}

ksp {
    arg("room.schemaLocation", "$projectDir/schemas")
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.9.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.2")
    implementation("androidx.lifecycle:lifecycle-process:2.8.2")
    
    // Leanback for Android TV
    implementation("androidx.leanback:leanback:1.0.0")

    // Retrofit & Moshi
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-moshi:2.11.0")
    implementation("com.squareup.moshi:moshi-kotlin:1.15.1")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

    // Media3 ExoPlayer
    implementation("androidx.media3:media3-exoplayer:1.3.1")
    implementation("androidx.media3:media3-ui:1.3.1")
    implementation("androidx.media3:media3-exoplayer-dash:1.3.1")

    // Room
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")

    // DataStore
    implementation("androidx.datastore:datastore-preferences:1.1.1")

    // WorkManager
    implementation("androidx.work:work-runtime-ktx:2.9.0")

    // Coil
    implementation("io.coil-kt:coil:2.6.0")

    // Hilt DI
    implementation("com.google.dagger:hilt-android:2.51.1")
    ksp("com.google.dagger:hilt-compiler:2.51.1")
    implementation("androidx.hilt:hilt-work:1.2.0")
    ksp("androidx.hilt:hilt-compiler:1.2.0")

    // Room Compiler
    ksp("androidx.room:room-compiler:2.6.1")

    // Testing Foundation
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.mockito.kotlin:mockito-kotlin:5.2.1")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.0")
    
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
    androidTestImplementation("com.google.dagger:hilt-android-testing:2.51.1")
    kspAndroidTest("com.google.dagger:hilt-compiler:2.51.1")
}
