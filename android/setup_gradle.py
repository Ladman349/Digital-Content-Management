import urllib.request
import zipfile
import os

url = "https://services.gradle.org/distributions/gradle-8.7-bin.zip"
zip_path = "gradle-8.7-bin.zip"

print(f"Downloading {url}...")
urllib.request.urlretrieve(url, zip_path)

print("Extracting...")
with zipfile.ZipFile(zip_path, 'r') as zip_ref:
    zip_ref.extractall(".")

print("Done. You can now use gradle-8.7/bin/gradle.bat")
