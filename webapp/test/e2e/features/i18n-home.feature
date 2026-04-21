Feature: Home translations

  Scenario: Logged user sees home content in English after switching language
    Given I am logged in with a newly registered user
    When I switch the language to English
    Then I should see "Hello" on the page
    And I should see "Instructions" on the page
    And I should see "Select difficulty" on the page

  Scenario: Logged user sees home content in Spanish after switching back
    Given I am logged in with a newly registered user
    When I switch the language to English
    And I switch the language to Spanish
    Then I should see "Hola" on the page
    And I should see "Instrucciones" on the page
    And I should see "Seleccionar dificultad" on the page