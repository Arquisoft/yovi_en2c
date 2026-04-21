Feature: Theme toggle

  Scenario: Logged user can switch from dark mode to light mode
    Given I am logged in with a newly registered user
    When I switch the theme
    Then the app theme should be "light"

  Scenario: Theme selection persists after reload
    Given I am logged in with a newly registered user
    When I switch the theme
    And I reload the page
    Then the app theme should be "light"