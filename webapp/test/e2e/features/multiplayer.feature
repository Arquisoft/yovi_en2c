Feature: Multiplayer

  Scenario: Logged user can open the multiplayer lobby
    Given I am logged in with a newly registered user
    And the multiplayer backend is mocked
    When I go to the multiplayer page
    Then I should see the multiplayer lobby

  Scenario: Logged user can create a multiplayer room
    Given I am logged in with a newly registered user
    And the multiplayer backend is mocked
    When I go to the multiplayer page
    And I create a multiplayer room
    Then I should be on the multiplayer game page
    And I should see the multiplayer board

  Scenario: Logged user can join a multiplayer room
    Given I am logged in with a newly registered user
    And the multiplayer backend is mocked
    When I go to the multiplayer page
    And I join multiplayer room "ROOM123"
    Then I should be on the multiplayer game page
    And I should see the multiplayer board