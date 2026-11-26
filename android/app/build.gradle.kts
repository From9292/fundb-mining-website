plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val releaseRequested = gradle.startParameter.taskNames.any {
    it.contains("release", ignoreCase = true)
}
val releaseApplicationId = providers.gradleProperty("releaseApplicationId").orNull
val releaseStoreFile = System.getenv("FUNDB_RELEASE_STORE_FILE")
val releaseStorePassword = System.getenv("FUNDB_RELEASE_STORE_PASSWORD")
val releaseKeyAlias = System.getenv("FUNDB_RELEASE_KEY_ALIAS")
val releaseKeyPassword = System.getenv("FUNDB_RELEASE_KEY_PASSWORD")

if (releaseRequested) {
    require(!releaseApplicationId.isNullOrBlank()) {
        "Release blocked: pass -PreleaseApplicationId with the final, unique Play Store package ID."
    }
    require(releaseApplicationId != "com.fundb.mining.preview") {
        "Release blocked: the preview package ID must never be published."
    }
    require(listOf(releaseStoreFile, releaseStorePassword, releaseKeyAlias, releaseKeyPassword)
        .all { !it.isNullOrBlank() }) {
        "Release blocked: configure all FUNDB_RELEASE_* signing secrets in GitHub Actions."
    }
    require(file(releaseStoreFile!!).isFile) {
        "Release blocked: signing keystore file was not found."
    }
}

android {
    namespace = "com.fundb.mining.preview"
    compileSdk = 35

    defaultConfig {
        applicationId = if (releaseRequested) releaseApplicationId!! else "com.fundb.mining.preview"
        minSdk = 23
        targetSdk = 35
        versionCode = 1
        versionName = if (releaseRequested) "1.0.0" else "0.1.0-preview"
    }

    signingConfigs {
        if (releaseRequested) {
            create("fundbRelease") {
                storeFile = file(releaseStoreFile!!)
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }

    buildTypes {
        getByName("release") {
            if (releaseRequested) signingConfig = signingConfigs.getByName("fundbRelease")
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}
