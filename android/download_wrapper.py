import urllib.request
import os

os.makedirs("gradle/wrapper", exist_ok=True)

files = {
    "gradlew": "https://raw.githubusercontent.com/gradle/gradle/v8.9.0/gradlew",
    "gradlew.bat": "https://raw.githubusercontent.com/gradle/gradle/v8.9.0/gradlew.bat",
    "gradle/wrapper/gradle-wrapper.jar": "https://raw.githubusercontent.com/gradle/gradle/v8.9.0/gradle/wrapper/gradle-wrapper.jar",
    "gradle/wrapper/gradle-wrapper.properties": "https://raw.githubusercontent.com/gradle/gradle/v8.9.0/gradle/wrapper/gradle-wrapper.properties"
}

for dest, url in files.items():
    print(f"Downloading {dest}...")
    urllib.request.urlretrieve(url, dest)
print("Done.")
