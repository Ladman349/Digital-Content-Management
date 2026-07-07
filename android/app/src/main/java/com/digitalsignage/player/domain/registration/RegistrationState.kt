package com.digitalsignage.player.domain.registration

enum class RegistrationState {
    Unregistered,
    Registering,
    Registered,
    RegistrationFailed,
    ReRegistrationRequired,
    TokenRefreshing,
    Banned
}
