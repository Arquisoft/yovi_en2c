Feature: Language toggle on login
  Scenario: User can switch language on login page
    Given the login page is open
    When I switch the language to English
    Then the English language button should be active