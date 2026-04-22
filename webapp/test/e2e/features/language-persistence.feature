Feature: Language persistence

  Scenario: Selected language persists after reload
    Given the login page is open
    When I switch the language to English
    And I refresh the page
    Then the English language button should be active