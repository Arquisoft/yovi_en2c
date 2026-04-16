Feature: Language toggle on register
  Scenario: User can switch language on register page
    Given the register page is open
    When I switch the language to Spanish
    Then the Spanish language button should be active