Feature: Statistics page

  Scenario: Logged user can open the statistics page
    Given I am logged in with a newly registered user
    When I click the statistics button on the home page
    Then I should be on the statistics page

  Scenario: Statistics page can be opened in English
    Given I am logged in with a newly registered user
    When I switch the language to English
    And I click the statistics button on the home page
    Then I should be on the statistics page
    And I should see "Statistics" on the page